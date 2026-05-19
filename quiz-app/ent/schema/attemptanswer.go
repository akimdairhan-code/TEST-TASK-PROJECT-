package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type AttemptAnswer struct {
	ent.Schema
}

func (AttemptAnswer) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "attempt_answers"},
	}
}

func (AttemptAnswer) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New).Unique(),
		field.UUID("attempt_id", uuid.UUID{}),
		field.UUID("question_id", uuid.UUID{}),
		field.String("user_text").Optional().Nillable(),
		field.UUID("answer_id", uuid.UUID{}).Optional().Nillable(),
	}
}

func (AttemptAnswer) Edges() []ent.Edge {
	return []ent.Edge{
		// Имена колонок как в SQL-миграциях (attempt_id / question_id), иначе Ent создаёт
		// attempt_attempt_answers / question_attempt_answers и запросы падают (42703).
		edge.From("attempt", Attempt.Type).Ref("attempt_answers").Unique().Required().Field("attempt_id"),
		edge.From("question", Question.Type).Ref("attempt_answers").Unique().Required().Field("question_id"),
		edge.From("answer", Answer.Type).Ref("attempt_answers").Unique().Field("answer_id"),
	}
}
