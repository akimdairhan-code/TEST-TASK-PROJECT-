//go:build ignore

package main

import (
"context"
"log"

"encore.app/ent/migrate"
"entgo.io/ent/dialect"
)

func main() {
ctx := context.Background()
err := migrate.WriteTo(ctx, dialect.Postgres, migrate.WithDropColumn(true), migrate.WithDropIndex(true))
if err != nil {
log.Fatalf("failed printing schema changes: %v", err)
}
}
