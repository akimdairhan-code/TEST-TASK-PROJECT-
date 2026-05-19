package quiz

import (
	"context"
	stdsql "database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"encore.app/ent"
	entattempt "encore.app/ent/attempt"
	entattemptanswer "encore.app/ent/attemptanswer"
	entquestion "encore.app/ent/question"
	entquiz "encore.app/ent/quiz"
	"encore.dev/beta/auth"
	"encore.dev/storage/sqldb"
	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
)

var quizDB = sqldb.Named("quiz")

var entClient *ent.Client

var schemaMu sync.Mutex

func columnExistsInCurrentSchema(db *stdsql.DB, table, column string) (bool, error) {
	ctx := context.Background()
	var ok bool
	err := db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2
		)`, table, column).Scan(&ok)
	return ok, err
}

func patchAttemptAnswersIfPossible(db *stdsql.DB) {
	ctx := context.Background()
	if _, err := db.ExecContext(ctx, `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'attempt_answers' AND column_name = 'answer_attempt_answers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'attempt_answers' AND column_name = 'answer_id'
  ) THEN
    ALTER TABLE attempt_answers RENAME COLUMN answer_attempt_answers TO answer_id;
  END IF;
END $$;`); err != nil {
		_ = err
	}
	_, _ = db.ExecContext(ctx, `ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS answer_id UUID`)
	_, _ = db.ExecContext(ctx, `ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS user_text TEXT`)
}

// lazyEnsureSchema проверяет схему. DDL выполняется только Encore-миграциями (auth/migrations/*.up.sql для БД «quiz»), не из кода —
// роль приложения часто не владелец таблиц (SQLSTATE 42501).
func lazyEnsureSchema(ctx context.Context) error {
	schemaMu.Lock()
	defer schemaMu.Unlock()

	db := quizDB.Stdlib()
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("БД недоступна: %w", err)
	}

	hasQT, err := columnExistsInCurrentSchema(db, "questions", "question_type")
	if err != nil {
		return fmt.Errorf("проверка схемы (questions): %w", err)
	}
	if !hasQT {
		return fmt.Errorf(
			"в БД нет колонки questions.question_type. " +
				"В проекте Encore добавлен файл миграции auth/migrations/2_add_question_type.up.sql (БД «quiz» объявлена в сервисе auth) — перезапустите «encore run», чтобы Encore применил её (миграции идут с правами владельца кластера). " +
				"Либо выполните вручную под владельцем таблицы:\n\n" +
				"ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'choice';\n\n" +
				"Если у вас уже есть миграции с номером 2, переименуйте файл в следующий свободный номер (3_, 4_ …).")
	}

	patchAttemptAnswersIfPossible(db)
	return nil
}

func init() {
	var err error
	entClient, err = ent.OpenEntClient(quizDB.Stdlib())
	if err != nil {
		panic(err)
	}
}

// ===== ТИПЫ =====

type Answer struct {
	ID         string `json:"id"`
	Text       string `json:"text"`
	IsCorrect  bool   `json:"is_correct"`
	OrderIndex int    `json:"order_index"`
}

type Question struct {
	ID           string   `json:"id"`
	Text         string   `json:"text"`
	OrderIndex   int      `json:"order_index"`
	QuestionType string   `json:"question_type"`
	Answers      []Answer `json:"answers"`
}

type Quiz struct {
	ID            string     `json:"id"`
	Title         string     `json:"title"`
	IsPublished   bool       `json:"is_published"`
	PassThreshold int        `json:"pass_threshold"`
	OneAttempt    bool       `json:"one_attempt"`
	ShowAnswers   bool       `json:"show_answers"`
	CreatedBy     string     `json:"created_by"`
	Questions     []Question `json:"questions,omitempty"`
}

type QuizListItem struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	IsPublished   bool   `json:"is_published"`
	QuestionCount int    `json:"question_count"`
	PassThreshold int    `json:"pass_threshold"`
	OneAttempt    bool   `json:"one_attempt"`
	ShowAnswers   bool   `json:"show_answers"`
	Status        string `json:"status"`
	Score         int    `json:"score"`
	Percent       int    `json:"percent"`
	Passed        bool   `json:"passed"`
}

type CreateQuizRequest struct {
	Title         string           `json:"title"`
	IsPublished   bool             `json:"is_published"`
	PassThreshold int              `json:"pass_threshold"`
	OneAttempt    bool             `json:"one_attempt"`
	ShowAnswers   bool             `json:"show_answers"`
	Questions     []CreateQuestion `json:"questions"`
}

type CreateQuestion struct {
	Text         string         `json:"text"`
	OrderIndex   int            `json:"order_index"`
	QuestionType string         `json:"question_type"`
	Answers      []CreateAnswer `json:"answers"`
}

type CreateAnswer struct {
	Text       string `json:"text"`
	IsCorrect  bool   `json:"is_correct"`
	OrderIndex int    `json:"order_index"`
}

type QuizListResponse struct {
	Quizzes []QuizListItem `json:"quizzes"`
}

type QuizResponse struct {
	Quiz Quiz `json:"quiz"`
}

type MessageResponse struct {
	Message string `json:"message"`
}

type PublishRequest struct {
	IsPublished bool `json:"is_published"`
}

type SubmitRequest struct {
	Answers []SubmitAnswer `json:"answers"`
}

type SubmitAnswer struct {
	QuestionID string      `json:"question_id"`
	AnswerID   string      `json:"answer_id"`
	TextAnswer string      `json:"text_answer,omitempty"`
	MatchPairs []MatchPair `json:"match_pairs,omitempty"`
}

type MatchPair struct {
	LeftAnswerID  string `json:"left_answer_id"`
	RightAnswerID string `json:"right_answer_id"`
}

type SubmitResult struct {
	Score       int            `json:"score"`
	Total       int            `json:"total"`
	Percent     int            `json:"percent"`
	Passed      bool           `json:"passed"`
	ShowAnswers bool           `json:"show_answers"`
	Details     []AnswerDetail `json:"details,omitempty"`
}

type AnswerDetail struct {
	QuestionText  string `json:"question_text"`
	YourAnswer    string `json:"your_answer"`
	CorrectAnswer string `json:"correct_answer"`
	IsCorrect     bool   `json:"is_correct"`
}

// ===== ADMIN: список всех квизов =====

//encore:api auth method=GET path=/admin/quizzes
func AdminListQuizzes(ctx context.Context) (*QuizListResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	if ud.Role != "admin" {
		return nil, errors.New("доступ запрещён")
	}
	client := entClient
	quizzes, err := client.Quiz.Query().WithQuestions().All(ctx)
	if err != nil {
		return nil, err
	}
	var result []QuizListItem
	for _, q := range quizzes {
		result = append(result, QuizListItem{
			ID:            q.ID.String(),
			Title:         q.Title,
			IsPublished:   q.IsPublished,
			PassThreshold: q.PassThreshold,
			OneAttempt:    q.OneAttempt,
			ShowAnswers:   q.ShowAnswers,
			QuestionCount: len(q.Edges.Questions),
		})
	}
	if result == nil {
		result = []QuizListItem{}
	}
	return &QuizListResponse{Quizzes: result}, nil
}

// ===== ADMIN: создать квиз =====

//encore:api auth method=POST path=/admin/quizzes
func AdminCreateQuiz(ctx context.Context, req *CreateQuizRequest) (*QuizResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	if ud.Role != "admin" {
		return nil, errors.New("доступ запрещён")
	}
	if req.Title == "" {
		return nil, errors.New("название обязательно")
	}
	if len(req.Questions) == 0 {
		return nil, errors.New("минимум 1 вопрос")
	}
	client := entClient
	q, err := client.Quiz.Create().
		SetTitle(req.Title).
		SetIsPublished(req.IsPublished).
		SetPassThreshold(req.PassThreshold).
		SetOneAttempt(req.OneAttempt).
		SetShowAnswers(req.ShowAnswers).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	for _, qReq := range req.Questions {
		qType := qReq.QuestionType
		if qType == "" {
			qType = "choice"
		}
		question, err := client.Question.Create().
			SetText(qReq.Text).
			SetOrderIndex(qReq.OrderIndex).
			SetQuestionType(qType).
			SetQuiz(q).
			Save(ctx)
		if err != nil {
			return nil, err
		}
		for _, aReq := range qReq.Answers {
			_, err := client.Answer.Create().
				SetText(aReq.Text).
				SetIsCorrect(aReq.IsCorrect).
				SetOrderIndex(aReq.OrderIndex).
				SetQuestion(question).
				Save(ctx)
			if err != nil {
				return nil, err
			}
		}
	}
	return getQuizByID(ctx, q.ID.String(), true)
}

// ===== ADMIN: получить квиз =====

//encore:api auth method=GET path=/admin/quizzes/:id
func AdminGetQuiz(ctx context.Context, id string) (*QuizResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	if ud.Role != "admin" {
		return nil, errors.New("доступ запрещён")
	}
	return getQuizByID(ctx, id, true)
}

// ===== ADMIN: обновить квиз =====

//encore:api auth method=PUT path=/admin/quizzes/:id
func AdminUpdateQuiz(ctx context.Context, id string, req *CreateQuizRequest) (*QuizResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	if ud.Role != "admin" {
		return nil, errors.New("доступ запрещён")
	}
	if req.Title == "" {
		return nil, errors.New("название обязательно")
	}
	client := entClient
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, errors.New("неверный id")
	}
	_, err = client.Quiz.UpdateOneID(uid).
		SetTitle(req.Title).
		SetIsPublished(req.IsPublished).
		SetPassThreshold(req.PassThreshold).
		SetOneAttempt(req.OneAttempt).
		SetShowAnswers(req.ShowAnswers).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	questions, err := client.Question.Query().
		Where(entquestion.HasQuizWith(entquiz.ID(uid))).
		WithAnswers().
		All(ctx)
	if err != nil {
		return nil, err
	}
	for _, q := range questions {
		for _, a := range q.Edges.Answers {
			if err := client.Answer.DeleteOneID(a.ID).Exec(ctx); err != nil {
				return nil, err
			}
		}
		if err := client.Question.DeleteOneID(q.ID).Exec(ctx); err != nil {
			return nil, err
		}
	}
	quizEnt, err := client.Quiz.Get(ctx, uid)
	if err != nil {
		return nil, err
	}
	for _, qReq := range req.Questions {
		qType := qReq.QuestionType
		if qType == "" {
			qType = "choice"
		}
		question, err := client.Question.Create().
			SetText(qReq.Text).
			SetOrderIndex(qReq.OrderIndex).
			SetQuestionType(qType).
			SetQuiz(quizEnt).
			Save(ctx)
		if err != nil {
			return nil, err
		}
		for _, aReq := range qReq.Answers {
			_, err := client.Answer.Create().
				SetText(aReq.Text).
				SetIsCorrect(aReq.IsCorrect).
				SetOrderIndex(aReq.OrderIndex).
				SetQuestion(question).
				Save(ctx)
			if err != nil {
				return nil, err
			}
		}
	}
	return getQuizByID(ctx, id, true)
}

// ===== ADMIN: удалить квиз =====

//encore:api auth method=DELETE path=/admin/quizzes/:id
func AdminDeleteQuiz(ctx context.Context, id string) (*MessageResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	if ud.Role != "admin" {
		return nil, errors.New("доступ запрещён")
	}
	client := entClient
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, errors.New("неверный id")
	}
	questions, err := client.Question.Query().
		Where(entquestion.HasQuizWith(entquiz.ID(uid))).
		WithAnswers().
		All(ctx)
	if err != nil {
		return nil, err
	}
	for _, q := range questions {
		for _, a := range q.Edges.Answers {
			if err := client.Answer.DeleteOneID(a.ID).Exec(ctx); err != nil {
				return nil, err
			}
		}
		if err := client.Question.DeleteOneID(q.ID).Exec(ctx); err != nil {
			return nil, err
		}
	}
	attempts, err := client.Attempt.Query().
		Where(func(s *sql.Selector) {
			s.Where(sql.EQ("quiz_id", uid))
		}).
		All(ctx)
	if err != nil {
		return nil, err
	}
	for _, a := range attempts {
		if err := client.Attempt.DeleteOneID(a.ID).Exec(ctx); err != nil {
			return nil, err
		}
	}
	err = client.Quiz.DeleteOneID(uid).Exec(ctx)
	if err != nil {
		return nil, err
	}
	return &MessageResponse{Message: "квиз удалён"}, nil
}

// ===== ADMIN: опубликовать/скрыть =====

//encore:api auth method=PATCH path=/admin/quizzes/:id/publish
func AdminPublishQuiz(ctx context.Context, id string, req *PublishRequest) (*MessageResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	if ud.Role != "admin" {
		return nil, errors.New("доступ запрещён")
	}
	client := entClient
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, errors.New("неверный id")
	}
	_, err = client.Quiz.UpdateOneID(uid).
		SetIsPublished(req.IsPublished).
		Save(ctx)
	if err != nil {
		return nil, err
	}
	return &MessageResponse{Message: "статус обновлён"}, nil
}

// ===== USER + ADMIN: список квизов со статусами =====

//encore:api auth method=GET path=/quizzes
func ListQuizzes(ctx context.Context) (*QuizListResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	client := entClient
	quizzes, err := client.Quiz.Query().
		Where(entquiz.IsPublished(true)).
		WithQuestions().
		All(ctx)
	if err != nil {
		return nil, err
	}
	userUID, _ := uuid.Parse(ud.UserID)
	var result []QuizListItem
	for _, q := range quizzes {
		item := QuizListItem{
			ID:            q.ID.String(),
			Title:         q.Title,
			IsPublished:   q.IsPublished,
			PassThreshold: q.PassThreshold,
			OneAttempt:    q.OneAttempt,
			ShowAnswers:   q.ShowAnswers,
			QuestionCount: len(q.Edges.Questions),
			Status:        "not_started",
		}
		attempt, err := client.Attempt.Query().
			Where(func(s *sql.Selector) {
				s.Where(sql.And(
					sql.EQ("quiz_id", q.ID),
					sql.EQ("user_id", userUID),
				))
			}).
			Order(ent.Desc(entattempt.FieldCreatedAt)).
			First(ctx)
		if err == nil && attempt != nil {
			percent := 0
			if attempt.Total > 0 {
				percent = (attempt.Score * 100) / attempt.Total
			}
			item.Score = attempt.Score
			item.Percent = percent
			item.Passed = percent >= q.PassThreshold
			item.Status = "completed"
		}
		result = append(result, item)
	}
	if result == nil {
		result = []QuizListItem{}
	}
	return &QuizListResponse{Quizzes: result}, nil
}

// ===== USER + ADMIN: получить квиз (для прохождения) =====

//encore:api auth method=GET path=/quizzes/:id
func GetQuiz(ctx context.Context, id string) (*QuizResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	client := entClient
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, errors.New("неверный id")
	}
	q, err := client.Quiz.Get(ctx, uid)
	if err != nil {
		return nil, errors.New("квиз не найден")
	}
	if !q.IsPublished && ud.Role != "admin" {
		return nil, errors.New("квиз недоступен")
	}
	userUID, err := uuid.Parse(ud.UserID)
	if err != nil {
		return nil, errors.New("неверный пользователь")
	}
	if q.OneAttempt {
		n, _ := client.Attempt.Query().
			Where(func(s *sql.Selector) {
				s.Where(sql.And(
					sql.EQ("quiz_id", uid),
					sql.EQ("user_id", userUID),
				))
			}).Count(ctx)
		if n > 0 {
			return nil, errors.New("вы уже проходили этот квиз")
		}
	}
	return getQuizByID(ctx, id, false)
}

// ===== USER + ADMIN: получить результат прошлой попытки =====

//encore:api auth method=GET path=/quizzes/:id/result
func GetQuizResult(ctx context.Context, id string) (*SubmitResult, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	client := entClient
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, errors.New("неверный id")
	}
	userUID, err := uuid.Parse(ud.UserID)
	if err != nil {
		return nil, errors.New("неверный пользователь")
	}
	quizEnt, err := client.Quiz.Query().
		Where(entquiz.ID(uid)).
		WithQuestions(func(qq *ent.QuestionQuery) {
			qq.WithAnswers()
		}).
		Only(ctx)
	if err != nil {
		return nil, errors.New("квиз не найден")
	}
	// Сначала только попытка: WithAttemptAnswers+WithQuestion на одном запросе давал ошибку SQL/Ent,
	// из‑за чего любой сбой превращался в «попытка не найдена», хотя строка в attempts есть.
	attempt, err := client.Attempt.Query().
		Where(func(s *sql.Selector) {
			s.Where(sql.And(
				sql.EQ("quiz_id", uid),
				sql.EQ("user_id", userUID),
			))
		}).
		Order(ent.Desc(entattempt.FieldCreatedAt)).
		First(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errors.New("попытка не найдена")
		}
		return nil, fmt.Errorf("попытка: %w", err)
	}
	percent := 0
	if attempt.Total > 0 {
		percent = (attempt.Score * 100) / attempt.Total
	}
	out := &SubmitResult{
		Score:       attempt.Score,
		Total:       attempt.Total,
		Percent:     percent,
		Passed:      percent >= quizEnt.PassThreshold,
		ShowAnswers: quizEnt.ShowAnswers,
	}
	if !quizEnt.ShowAnswers {
		return out, nil
	}

	aas, err := client.AttemptAnswer.Query().
		Where(entattemptanswer.HasAttemptWith(entattempt.ID(attempt.ID))).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("ответы попытки: %w", err)
	}

	aaByQuestion := make(map[uuid.UUID][]*ent.AttemptAnswer)
	for _, aa := range aas {
		qid := aa.QuestionID
		aaByQuestion[qid] = append(aaByQuestion[qid], aa)
	}

	questions := quizEnt.Edges.Questions
	sort.Slice(questions, func(i, j int) bool {
		return questions[i].OrderIndex < questions[j].OrderIndex
	})
	realignOrphanAttemptAnswers(questions, aas, aaByQuestion)

	var details []AnswerDetail
	for _, qEnt := range questions {
		qType := qEnt.QuestionType
		if qType == "" {
			qType = "choice"
		}
		rows := aaByQuestion[qEnt.ID]
		detail := AnswerDetail{QuestionText: qEnt.Text}

		switch qType {
		case "text":
			var your, correct string
			if len(rows) > 0 && rows[0].UserText != nil {
				your = *rows[0].UserText
			}
			for _, a := range qEnt.Edges.Answers {
				if a.IsCorrect {
					correct = a.Text
					detail.IsCorrect = strings.EqualFold(strings.TrimSpace(your), strings.TrimSpace(a.Text))
					break
				}
			}
			detail.YourAnswer = your
			detail.CorrectAnswer = correct

		case "match":
			var pairs []MatchPair
			if len(rows) > 0 && rows[0].UserText != nil && *rows[0].UserText != "" {
				_ = json.Unmarshal([]byte(*rows[0].UserText), &pairs)
			}
			exp := matchExpectedRights(qEnt.Edges.Answers)
			allOK := len(exp) > 0 && len(pairs) == len(exp)
			if allOK {
				pairLoop:
				for leftID, wantRight := range exp {
					found := false
					for _, p := range pairs {
						lid, err1 := uuid.Parse(p.LeftAnswerID)
						rid, err2 := uuid.Parse(p.RightAnswerID)
						if err1 != nil || err2 != nil {
							allOK = false
							break pairLoop
						}
						if lid == leftID && rid == wantRight {
							found = true
							break
						}
					}
					if !found {
						allOK = false
						break
					}
				}
			} else if len(exp) > 0 {
				allOK = false
			}
			detail.IsCorrect = allOK
			ansByID := answerTextByID(qEnt.Edges.Answers)
			var parts []string
			for _, p := range pairs {
				lt := ansByID[p.LeftAnswerID]
				rt := ansByID[p.RightAnswerID]
				if lt != "" || rt != "" {
					parts = append(parts, lt+" → "+rt)
				}
			}
			detail.YourAnswer = strings.Join(parts, "; ")
			sortedAns := sortAnswersEnt(qEnt.Edges.Answers)
			var wantParts []string
			for i := 0; i+1 < len(sortedAns); i += 2 {
				wantParts = append(wantParts, sortedAns[i].Text+" → "+sortedAns[i+1].Text)
			}
			detail.CorrectAnswer = strings.Join(wantParts, "; ")

		default:
			var correctAnsID uuid.UUID
			for _, a := range qEnt.Edges.Answers {
				if a.IsCorrect {
					detail.CorrectAnswer = a.Text
					correctAnsID = a.ID
					break
				}
			}
			var sel *ent.Answer
			if len(rows) > 0 && rows[0].AnswerID != nil && *rows[0].AnswerID != uuid.Nil {
				aid := *rows[0].AnswerID
				if a, err := client.Answer.Get(ctx, aid); err == nil {
					sel = a
				} else {
					for _, cand := range qEnt.Edges.Answers {
						if cand.ID == aid {
							sel = cand
							break
						}
					}
				}
			}
			if sel == nil {
				detail.YourAnswer = ""
				break
			}
			detail.YourAnswer = sel.Text
			if correctAnsID != uuid.Nil {
				detail.IsCorrect = sel.ID == correctAnsID
			} else {
				detail.IsCorrect = sel.IsCorrect
			}
		}
		details = append(details, detail)
	}
	out.Details = details
	return out, nil
}

// ===== USER + ADMIN: отправить ответы =====

//encore:api auth method=POST path=/quizzes/:id/submit
func SubmitQuiz(ctx context.Context, id string, req *SubmitRequest) (*SubmitResult, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	ud := auth.Data().(*UserData)
	client := entClient
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, errors.New("неверный id")
	}
	q, err := client.Quiz.Get(ctx, uid)
	if err != nil {
		return nil, errors.New("квиз не найден")
	}
	if !q.IsPublished && ud.Role != "admin" {
		return nil, errors.New("квиз недоступен")
	}
	userUID, err := uuid.Parse(ud.UserID)
	if err != nil {
		return nil, errors.New("неверный пользователь")
	}
	if q.OneAttempt {
		count, _ := client.Attempt.Query().
			Where(func(s *sql.Selector) {
				s.Where(sql.And(
					sql.EQ("quiz_id", uid),
					sql.EQ("user_id", userUID),
				))
			}).Count(ctx)
		if count > 0 {
			return nil, errors.New("вы уже проходили этот квиз")
		}
	}

	qQuestions, err := client.Question.Query().
		Where(entquestion.HasQuizWith(entquiz.ID(uid))).
		WithAnswers().
		All(ctx)
	if err != nil {
		return nil, err
	}
	sort.Slice(qQuestions, func(i, j int) bool {
		return qQuestions[i].OrderIndex < qQuestions[j].OrderIndex
	})
	total := len(qQuestions)

	findSubmit := func(qid string) *SubmitAnswer {
		for i := range req.Answers {
			if req.Answers[i].QuestionID == qid {
				return &req.Answers[i]
			}
		}
		return nil
	}

	score := 0
	var details []AnswerDetail

	for _, qEnt := range qQuestions {
		qType := qEnt.QuestionType
		if qType == "" {
			qType = "choice"
		}
		a := findSubmit(qEnt.ID.String())
		detail := AnswerDetail{QuestionText: qEnt.Text}

		switch qType {
		case "text":
			your := ""
			if a != nil {
				your = strings.TrimSpace(a.TextAnswer)
			}
			var correctText string
			var correctEnt *ent.Answer
			for _, ans := range qEnt.Edges.Answers {
				if ans.IsCorrect {
					correctText = ans.Text
					correctEnt = ans
					break
				}
			}
			isOK := correctEnt != nil && strings.EqualFold(your, strings.TrimSpace(correctEnt.Text))
			if isOK {
				score++
			}
			detail.YourAnswer = your
			detail.CorrectAnswer = correctText
			detail.IsCorrect = isOK

		case "match":
			exp := matchExpectedRights(qEnt.Edges.Answers)
			var pairs []MatchPair
			if a != nil {
				pairs = a.MatchPairs
			}
			allOK := len(exp) > 0 && len(pairs) == len(exp)
			if allOK {
				pairLoop:
				for leftID, wantRight := range exp {
					found := false
					for _, p := range pairs {
						lid, err1 := uuid.Parse(p.LeftAnswerID)
						rid, err2 := uuid.Parse(p.RightAnswerID)
						if err1 != nil || err2 != nil {
							allOK = false
							break pairLoop
						}
						if lid == leftID && rid == wantRight {
							found = true
							break
						}
					}
					if !found {
						allOK = false
						break
					}
				}
			} else if len(exp) > 0 {
				allOK = false
			}
			if allOK {
				score++
			}
			detail.IsCorrect = allOK
			byID := answerTextByID(qEnt.Edges.Answers)
			var parts []string
			for _, p := range pairs {
				parts = append(parts, byID[p.LeftAnswerID]+" → "+byID[p.RightAnswerID])
			}
			detail.YourAnswer = strings.Join(parts, "; ")
			sortedAns := sortAnswersEnt(qEnt.Edges.Answers)
			var wantParts []string
			for i := 0; i+1 < len(sortedAns); i += 2 {
				wantParts = append(wantParts, sortedAns[i].Text+" → "+sortedAns[i+1].Text)
			}
			detail.CorrectAnswer = strings.Join(wantParts, "; ")

		default:
			var correctAnsID uuid.UUID
			for _, ans := range qEnt.Edges.Answers {
				if ans.IsCorrect {
					correctAnsID = ans.ID
					break
				}
			}
			if a == nil || a.AnswerID == "" {
				detail.YourAnswer = ""
				for _, ans := range qEnt.Edges.Answers {
					if ans.IsCorrect {
						detail.CorrectAnswer = ans.Text
						break
					}
				}
				detail.IsCorrect = false
				break
			}
			answerUID, err := uuid.Parse(a.AnswerID)
			if err != nil {
				detail.IsCorrect = false
				break
			}
			answerEnt, err := client.Answer.Get(ctx, answerUID)
			if err != nil || answerEnt.QuestionID != qEnt.ID {
				detail.IsCorrect = false
				break
			}
			detail.YourAnswer = answerEnt.Text
			ok := false
			if correctAnsID != uuid.Nil {
				ok = answerEnt.ID == correctAnsID
			} else {
				ok = answerEnt.IsCorrect
			}
			detail.IsCorrect = ok
			if ok {
				score++
			}
			for _, ans := range qEnt.Edges.Answers {
				if ans.IsCorrect {
					detail.CorrectAnswer = ans.Text
					break
				}
			}
		}

		if q.ShowAnswers {
			details = append(details, detail)
		}
	}

	attempt, err := client.Attempt.Create().
		SetScore(score).
		SetTotal(total).
		SetQuizID(uid).
		SetUserID(userUID).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	for _, qEnt := range qQuestions {
		qType := qEnt.QuestionType
		if qType == "" {
			qType = "choice"
		}
		a := findSubmit(qEnt.ID.String())
		switch qType {
		case "text":
			txt := ""
			if a != nil {
				txt = a.TextAnswer
			}
			b := client.AttemptAnswer.Create().
				SetAttemptID(attempt.ID).
				SetQuestionID(qEnt.ID)
			if strings.TrimSpace(txt) != "" {
				b = b.SetUserText(strings.TrimSpace(txt))
			}
			_, _ = b.Save(ctx)

		case "match":
			var pairs []MatchPair
			if a != nil {
				pairs = a.MatchPairs
			}
			raw, _ := json.Marshal(pairs)
			_, _ = client.AttemptAnswer.Create().
				SetAttemptID(attempt.ID).
				SetQuestionID(qEnt.ID).
				SetUserText(string(raw)).
				Save(ctx)

		default:
			if a == nil || a.AnswerID == "" {
				continue
			}
			answerUID, err := uuid.Parse(a.AnswerID)
			if err != nil {
				continue
			}
			_, _ = client.AttemptAnswer.Create().
				SetAttemptID(attempt.ID).
				SetQuestionID(qEnt.ID).
				SetAnswerID(answerUID).
				Save(ctx)
		}
	}

	percent := 0
	if total > 0 {
		percent = (score * 100) / total
	}
	return &SubmitResult{
		Score:       score,
		Total:       total,
		Percent:     percent,
		Passed:      percent >= q.PassThreshold,
		ShowAnswers: q.ShowAnswers,
		Details:     details,
	}, nil
}

// ===== ВСПОМОГАТЕЛЬНАЯ =====

// realignOrphanAttemptAnswers: после редактирования квиза в attempt_answers остаются старые question_id.
// Если число строк с «чужим» question_id совпадает с числом текущих вопросов без привязки — сопоставляем по порядку (order_index).
func realignOrphanAttemptAnswers(questions []*ent.Question, aas []*ent.AttemptAnswer, aaByQuestion map[uuid.UUID][]*ent.AttemptAnswer) {
	if len(questions) == 0 || len(aas) == 0 {
		return
	}
	cur := make(map[uuid.UUID]struct{}, len(questions))
	for _, q := range questions {
		cur[q.ID] = struct{}{}
	}
	var orphans []*ent.AttemptAnswer
	for _, aa := range aas {
		if _, ok := cur[aa.QuestionID]; !ok {
			orphans = append(orphans, aa)
		}
	}
	if len(orphans) == 0 {
		return
	}
	var missing []*ent.Question
	for _, q := range questions {
		if len(aaByQuestion[q.ID]) == 0 {
			missing = append(missing, q)
		}
	}
	if len(orphans) != len(missing) || len(missing) == 0 {
		return
	}
	sort.Slice(orphans, func(i, j int) bool {
		return orphans[i].ID.String() < orphans[j].ID.String()
	})
	for i := range orphans {
		aaByQuestion[missing[i].ID] = []*ent.AttemptAnswer{orphans[i]}
	}
}

func sortAnswersEnt(as []*ent.Answer) []*ent.Answer {
	if len(as) == 0 {
		return as
	}
	cp := append([]*ent.Answer(nil), as...)
	sort.Slice(cp, func(i, j int) bool {
		return cp[i].OrderIndex < cp[j].OrderIndex
	})
	return cp
}

func matchExpectedRights(as []*ent.Answer) map[uuid.UUID]uuid.UUID {
	sorted := sortAnswersEnt(as)
	m := make(map[uuid.UUID]uuid.UUID)
	for i := 0; i+1 < len(sorted); i += 2 {
		m[sorted[i].ID] = sorted[i+1].ID
	}
	return m
}

func answerTextByID(as []*ent.Answer) map[string]string {
	out := make(map[string]string)
	for _, a := range as {
		out[a.ID.String()] = a.Text
	}
	return out
}

func getQuizByID(ctx context.Context, id string, withCorrect bool) (*QuizResponse, error) {
	if err := lazyEnsureSchema(ctx); err != nil {
		return nil, err
	}
	client := entClient
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, errors.New("неверный id")
	}
	q, err := client.Quiz.Query().
		Where(entquiz.ID(uid)).
		WithQuestions(func(qq *ent.QuestionQuery) {
			qq.WithAnswers()
		}).
		Only(ctx)
	if err != nil {
		return nil, errors.New("квиз не найден")
	}
	var questions []Question
	for _, question := range q.Edges.Questions {
		var answers []Answer
		for _, a := range question.Edges.Answers {
			answer := Answer{
				ID:         a.ID.String(),
				Text:       a.Text,
				OrderIndex: a.OrderIndex,
			}
			if withCorrect {
				answer.IsCorrect = a.IsCorrect
			}
			answers = append(answers, answer)
		}
		questions = append(questions, Question{
			ID:           question.ID.String(),
			Text:         question.Text,
			OrderIndex:   question.OrderIndex,
			QuestionType: question.QuestionType,
			Answers:      answers,
		})
	}
	return &QuizResponse{Quiz: Quiz{
		ID:            q.ID.String(),
		Title:         q.Title,
		IsPublished:   q.IsPublished,
		PassThreshold: q.PassThreshold,
		OneAttempt:    q.OneAttempt,
		ShowAnswers:   q.ShowAnswers,
		Questions:     questions,
	}}, nil
}
