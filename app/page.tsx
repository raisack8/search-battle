import Link from 'next/link'
import { QUIZZES } from '@/lib/quizData'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="max-w-md mx-auto px-4 py-12 flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">Search Battle</h1>
          <p className="mt-2 text-gray-400 text-sm">お題を調べて正解を見つけろ</p>
        </div>

        <div className="w-full space-y-3">
          {QUIZZES.map((quiz) => (
            <Link
              key={quiz.id}
              href={`/quiz/${quiz.id}`}
              className="block w-full bg-white/10 hover:bg-white/20 transition rounded-xl p-4"
            >
              <div className="flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={quiz.imageUrl}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
                <div>
                  <div className="text-xs text-blue-300 font-bold uppercase mb-1">
                    {quiz.type === 'number' ? '数値問題' : 'これって何？'} · {quiz.timeLimitSeconds}秒
                  </div>
                  <p className="font-bold leading-snug">{quiz.question}</p>
                  <p className="text-xs text-gray-400 mt-1">{quiz.hint}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
