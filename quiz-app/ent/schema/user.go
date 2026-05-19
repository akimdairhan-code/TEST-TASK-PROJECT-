package schema

import (
"entgo.io/ent"
"entgo.io/ent/schema/edge"
"entgo.io/ent/schema/field"
"github.com/google/uuid"
)

type User struct {
ent.Schema
}

func (User) Fields() []ent.Field {
return []ent.Field{
field.UUID("id", uuid.UUID{}).Default(uuid.New).Unique(),
field.String("email").Unique(),
field.String("password_hash"),
field.String("role").Default("user"),
field.Time("created_at").Optional(),
}
}

func (User) Edges() []ent.Edge {
return []ent.Edge{
edge.To("quizzes", Quiz.Type),
edge.To("attempts", Attempt.Type),
}
}
