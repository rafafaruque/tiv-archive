import AdminParseCache from '../../../components/AdminParseCache'

export const metadata = {
  title: 'Parse Cache Admin'
}

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Parse Cache Admin</h1>
      <p>View and clear the NL parse cache used for development.</p>
      <AdminParseCache />
    </main>
  )
}
