import type { Quiz } from '@/types'

export const QUIZZES: Quiz[] = [
  {
    id: 'q1',
    type: 'number',
    question: '東京スカイツリーの高さは何メートル？',
    hint: '東京にある電波塔。2012年に開業。',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Tokyo_Sky_Tree_2012.JPG/800px-Tokyo_Sky_Tree_2012.JPG',
    answerNumber: 634,
    answerUnit: 'm',
    timeLimitSeconds: 120,
  },
  {
    id: 'q2',
    type: 'number',
    question: '富士山の標高は何メートル？',
    hint: '日本一高い山。静岡・山梨県境に位置する。',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FujiSunriseKawaguchiko2025PhotoAFlo.jpg/1280px-FujiSunriseKawaguchiko2025PhotoAFlo.jpg',
    answerNumber: 3776,
    answerUnit: 'm',
    timeLimitSeconds: 120,
  },
  {
    id: 'q3',
    type: 'what',
    question: 'これって何という建物？',
    hint: 'フランス・パリにある鉄の塔。1889年に建設。',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/800px-Tour_Eiffel_Wikimedia_Commons.jpg',
    answerText: 'エッフェル塔',
    answerAliases: ['エッフェルとう', 'Tour Eiffel', 'Eiffel Tower', 'eiffel tower'],
    timeLimitSeconds: 90,
  },
  {
    id: 'q4',
    type: 'what',
    question: 'これは何という世界遺産？',
    hint: 'ペルーにある有名な遺跡。標高2,400mの山の尾根に位置する。',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Machu_Picchu%2C_Peru.jpg/1280px-Machu_Picchu%2C_Peru.jpg',
    answerText: 'マチュ・ピチュ',
    answerAliases: ['マチュピチュ', 'Machu Picchu', 'machu picchu'],
    timeLimitSeconds: 90,
  },
]

export function getQuiz(id: string): Quiz | undefined {
  return QUIZZES.find((q) => q.id === id)
}

export function getRandomQuiz(): Quiz {
  return QUIZZES[Math.floor(Math.random() * QUIZZES.length)]
}
