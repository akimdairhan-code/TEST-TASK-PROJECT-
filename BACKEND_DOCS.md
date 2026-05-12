# Документация по генерации ent схем и миграций!

## Требования

- Go 1.21+
- [Atlas CLI](https://atlasgo.io/getting-started)
- Encore CLI

## 1. Генерация ent кода из схем

После любого изменения файлов в `ent/schema/` нужно регенерировать код.

### Команда:
bash
go generate ./ent


### Что происходит:
- Ent читает схемы из папки `ent/schema/`
- Генерирует Go код для работы с БД в папке `ent/`
- Создаются методы: `Create()`, `Update()`, `Delete()`, `Query()` для каждой сущности

### Пример — добавить новое поле в схему:
go
// ent/schema/quiz.go
func (Quiz) Fields() []ent.Field {
    return []ent.Field{
        field.String("title"),
        field.String("description").Optional(), // новое поле
    }
}


После изменения запусти:
bash
go generate ./ent

## 2. Создание новой схемы

Чтобы создать новую схему (новую таблицу):

bash
go run entgo.io/ent/cmd/ent new ModelName


Например:
bash
go run entgo.io/ent/cmd/ent new Category

Создаётся файл `ent/schema/category.go`. После редактирования запусти:
bash
go generate ./ent

## 3. Миграции с Atlas

Atlas используется для применения изменений схемы к базе данных.

### Установка Atlas (Windows):
powershell
Invoke-WebRequest -Uri "https://release.ariga.io/atlas/atlas-windows-amd64-latest.exe" -OutFile "$env:USERPROFILE\go\bin\atlas.exe"
$env:PATH += ";$env:USERPROFILE\go\bin"

### Установка Atlas (Linux/Mac):
bash
curl -sSf https://atlasgo.sh | sh


### Структура миграций

Миграции находятся в папке `ent/migrations/`.

Формат имени файла: `{номер}_{описание}.up.sql`

Пример: `1_create_tables.up.sql`

### Создание новой миграции вручную

1. Создай файл `ent/migrations/2_add_description.up.sql`
2. Напиши SQL:

sql
ALTER TABLE quizzes ADD COLUMN description TEXT;

### Применение миграций через Encore

Encore автоматически применяет миграции при деплое.

При локальном запуске:
bash
encore run

Encore сам применит все миграции из папки `ent/migrations/`.

### Применение миграций через Atlas вручную

bash
atlas migrate apply \
  --dir "file://ent/migrations" \
  --url "postgres://user:password@localhost:5432/dbname"


## 4. Полный рабочий процесс

### При изменении существующей схемы:

bash
# 1. Измени файл в ent/schema/
# 2. Регенерируй ent код
go generate ./ent

# 3. Создай SQL миграцию в ent/migrations/
# Например: ent/migrations/2_add_field.up.sql

# 4. Задеплой — Encore применит миграцию автоматически
git add .
git commit -m "feat: add new field"
git push encore main


### При создании новой таблицы:

bash
# 1. Создай схему
go run entgo.io/ent/cmd/ent new ModelName

# 2. Опиши поля и связи в ent/schema/modelname.go

# 3. Регенерируй код
go generate ./ent

# 4. Добавь CREATE TABLE в миграцию
# ent/migrations/2_create_modelname.up.sql

# 5. Задеплой
git add .
git commit -m "feat: add ModelName"
git push encore main

## 5. Структура папки ent/

ent/
├── schema/           — описание таблиц (редактируешь вручную)
│   ├── user.go
│   ├── quiz.go
│   ├── question.go
│   ├── answer.go
│   ├── attempt.go
│   └── attemptanswer.go
├── migrations/       — SQL миграции (редактируешь вручную)
│   └── 1_create_tables.up.sql
├── generate.go       — файл запуска генерации (не трогать)
├── client.go         — сгенерированный код (не трогать)
├── db.go             — подключение к БД
└── ...               — остальные сгенерированные файлы


## 6. Важные правила!!!!!!!!!!!!!!!!!!!!!!!!!

- **Никогда не редактируй** сгенерированные файлы в `ent/` напрямую — они перезапишутся при следующей генерации
- **Всегда запускай** `go generate ./ent` после изменения схем
- **Не удаляй** старые миграции — они нужны для воспроизведения состояния БД
- При переименовании таблицы используй **аннотацию** `entsql.Annotation{Table: "имя_таблицы"}`
