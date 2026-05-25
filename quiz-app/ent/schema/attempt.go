package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type Attempt struct {
	ent.Schema
}

func (Attempt) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New).Unique(),
		field.Int("score"),
		field.Int("total"),
		field.UUID("quiz_id", uuid.UUID{}).Optional(),
		field.UUID("user_id", uuid.UUID{}).Optional(),
		field.Time("created_at").Optional(),
	}
}

func (Attempt) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("quiz", Quiz.Type).Ref("attempts").Unique().Field("quiz_id"),
		edge.From("user", User.Type).Ref("attempts").Unique().Field("user_id"),
		edge.To("attempt_answers", AttemptAnswer.Type),
	}
}