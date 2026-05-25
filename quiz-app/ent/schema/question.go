package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type Question struct {
	ent.Schema
}

func (Question) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New).Unique(),
		field.String("text"),
		field.Int("order_index").Default(0),
		field.UUID("quiz_id", uuid.UUID{}).Optional(),
		field.String("question_type").Default("choice"),
	}
}

func (Question) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("quiz", Quiz.Type).Ref("questions").Unique().Field("quiz_id"),
		edge.To("answers", Answer.Type),
		edge.To("attempt_answers", AttemptAnswer.Type),
	}
}