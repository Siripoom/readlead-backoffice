import { requireAdmin } from '@/lib/auth'
import { ExpManager } from '@/components/exp/ExpManager'
import { Noto_Sans_Thai, Noto_Serif_Thai } from 'next/font/google'

const notoSansThai = Noto_Sans_Thai({ subsets: ['thai'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-exp-sans', display: 'swap' })
const notoSerifThai = Noto_Serif_Thai({ subsets: ['thai'], weight: ['700', '900'], variable: '--font-exp-serif', display: 'swap' })

export default async function ExpPage() {
  await requireAdmin('exp')
  return <div className={`${notoSansThai.variable} ${notoSerifThai.variable}`}><ExpManager /></div>
}
