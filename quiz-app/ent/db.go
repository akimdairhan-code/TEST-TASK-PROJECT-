package ent

import (
"database/sql"

"entgo.io/ent/dialect"
entsql "entgo.io/ent/dialect/sql"
)

func OpenEntClient(db *sql.DB) (*Client, error) {
drv := entsql.OpenDB(dialect.Postgres, db)
return NewClient(Driver(drv)), nil
}
