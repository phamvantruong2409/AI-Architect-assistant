import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Khảo sát phong cách thiết kế',
  description: 'Giúp kiến trúc sư hiểu phong cách của bạn',
}

export default function BriefLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {children}
    </div>
  )
}
