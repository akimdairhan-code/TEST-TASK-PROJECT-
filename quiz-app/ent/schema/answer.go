package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type Answer struct {
	ent.Schema
}

func (Answer) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New).Unique(),
		field.String("text"),
		field.Bool("is_correct").Default(false),
		field.Int("order_index").Default(0),
		field.UUID("question_id", uuid.UUID{}).Optional(),
	}
}

func (Answer) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("question", Question.Type).Ref("answers").Unique().Field("question_id"),
		edge.To("attempt_answers", AttemptAnswer.Type),
	}
}