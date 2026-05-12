

## Что такое Encore Client?

Encore может автоматически сгенерировать TypeScript клиент для фронтенда на основе бэкенд API. Это позволяет вызывать API с типизацией вместо ручного написания axios запросов.

Требования!

Encore CLI установлен
Бэкенд запущен локально (`encore run`) или задеплоен

## 1. Установка Encore CLI

### Windows:
```powershell
iwr https://encore.dev/install.ps1 | iex
```

### Mac/Linux:
bash
curl -L https://encore.dev/install.sh | bash

## 2. Генерация клиента

Из локального запущенного бэкенда:

bash
encore gen client quiz-app-43t2 --output=./lib/client.ts --env=local

Из задеплоенного staging окружения:

bash
encore gen client quiz-app-43t2 --output=./lib/client.ts --env=staging

### Из production окружения:

bash
encore gen client quiz-app-43t2 --output=./lib/client.ts --env=production

## 3. Использование сгенерированного клиента

После генерации в `lib/client.ts` появится типизированный клиент.

### Пример использования:

typescript
import Client, { Local } from "./lib/client";

# Создаём клиент!
const client = new Client(Local);

# Логин!
const response = await client.auth.Login({
  email: "admin@test.com",
  password: "admin123"
});

# Получить список квизов
const quizzes = await client.quiz.AdminListQuizzes();

# Создать квиз
const newQuiz = await client.quiz.AdminCreateQuiz({
  title: "Математика",
  is_published: true,
  pass_threshold: 50,
  one_attempt: false,
  show_answers: true,
  questions: [
    {
      text: "1 + 1 = ?",
      order_index: 0,
      answers: [
        { text: "2", is_correct: true, order_index: 0 },
        { text: "3", is_correct: false, order_index: 1 }
      ]
    }
  ]
});

## 4. Настройка авторизации в клиенте

typescript
import Client, { Local } from "./lib/client";

# Получаем токен из localStorage
const token = localStorage.getItem("token");

# Создаём клиент с токеном
const client = new Client(Local, {
  auth: token ?? ""
});

# 5. Полный рабочий процесс

bash
# 1. Запусти бэкенд локально
cd quiz-app
encore run

# 2. В другом терминале — перейди во фронтенд
cd my-app

# 3. Сгенерируй клиент
encore gen client quiz-app-43t2 --output=./lib/client.ts --env=local

# 4. Используй client.ts в коде фронтенда вместо axios


###### 6. Когда нужно перегенерировать клиент?

Перегенерировать `client.ts` нужно когда:

- Добавили новый эндпоинт на бэкенде
- Изменили типы запроса или ответа
- Изменили путь эндпоинта
- Добавили или убрали авторизацию на эндпоинте

bash
# Просто запусти снова
encore gen client quiz-app-43t2 --output=./lib/client.ts --env=staging


## 7. Отличие от ручного axios

### до(ручной axios):
typescript
// lib/api.ts — пишем вручную, нет типизации
export const adminCreateQuiz = (data: any) => 
  api.post("/admin/quizzes", data);

### После (Encore client):
typescript
// Типизированный вызов, автодополнение в IDE
const quiz = await client.quiz.AdminCreateQuiz({
  title: "Математика",  // IDE подскажет все поля
  questions: [...]
});

**Преимущества:**
- Автодополнение в VS Code
- Ошибки типов видны сразу при написании кода
- Не нужно вручную описывать типы запросов и ответов
- Автоматически обновляется при изменении бэкенда
