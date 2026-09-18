import type {Metadata} from 'next'
import Theme from './theme'
import {Data} from './data/load'

export const metadata: Metadata = {
  title: 'CT Education Funding',
  description: 'Presents Connecticut education data, with a focus on funding.',
}

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>
        <Theme>
          <Data>{children}</Data>
        </Theme>
      </body>
    </html>
  )
}
