import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import UploadPage from './pages/UploadPage'
import ResourcesPage from './pages/ResourcesPage'
import TasksPage from './pages/TasksPage'
import LogsPage from './pages/LogsPage'
import ResourceDetailPage from './pages/ResourceDetailPage'
import TaskDetailPage from './pages/TaskDetailPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<UploadPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="resources/:id" element={<ResourceDetailPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="logs" element={<LogsPage />} />
      </Route>
    </Routes>
  )
}

export default App
