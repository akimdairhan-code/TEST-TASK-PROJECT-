data "ent_schema" "app" {
  path = "encore.app/ent"
}

env "local" {
  src = data.ent_schema.app.url
  dev = "docker://postgres/15/dev?search_path=public"
  migration {
    dir = "file://auth/migrations"
  }
}
