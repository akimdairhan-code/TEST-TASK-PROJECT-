package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type Quiz struct {
	ent.Schema
}

func (Quiz) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "quizzes"},
	}
}

func (Quiz) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Default(uuid.New).Unique(),
		field.String("title"),
		field.Bool("is_published").Default(false),
		field.Int("pass_threshold").Default(0),
		field.Bool("one_attempt").Default(false),
		field.Bool("show_answers").Default(false),
		field.Time("created_at").Optional(),
	}
}

func (Quiz) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("created_by", User.Type).Ref("quizzes").Unique(),
		edge.To("questions", Question.Type),
		edge.To("attempts", Attempt.Type),
	}
}
