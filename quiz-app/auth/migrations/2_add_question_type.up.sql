-- Тип вопроса (выбор / текст / сопоставление) и поля для attempt_answers (свободный ввод / match).
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'choice';

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
END $$;

ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS answer_id UUID;
ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS user_text TEXT;
