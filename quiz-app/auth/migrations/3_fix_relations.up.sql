ALTER TABLE attempt_answers DROP COLUMN IF EXISTS answer_id;
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS answer_id UUID REFERENCES answers(id);
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS user_text TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
