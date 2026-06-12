import { notFound } from 'next/navigation'
import { getQuiz } from '@/lib/quizData'
import QuizGame from '@/components/QuizGame'

interface Props {
  params: Promise<{ id: string }>
}

export default async function QuizPage({ params }: Props) {
  const { id } = await params
  const quiz = getQuiz(id)
  if (!quiz) notFound()
  return <QuizGame quiz={quiz} />
}
