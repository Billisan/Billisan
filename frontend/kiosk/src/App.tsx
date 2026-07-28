import { useState } from 'react'
import { FaceGuideOverlay } from './components/common/FaceGuideOverlay'
import { CameraCaptureScreen } from './screens/common/CameraCaptureScreen'
import { MainScreen } from './screens/SCR-KSK-MAIN-001/MainScreen'

const FACE_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN

function App() {
  const [showCameraPreview, setShowCameraPreview] = useState(false)

  if (!showCameraPreview) {
    return (
      <MainScreen variant="DEFAULT" onRent={() => setShowCameraPreview(true)} />
    )
  }

  return (
    <CameraCaptureScreen
      streamUrl={`http://127.0.0.1:8080/video?token=${encodeURIComponent(FACE_STREAM_TOKEN)}`}
      guide={<FaceGuideOverlay />}
      onBack={() => setShowCameraPreview(false)}
    />
  )
}

export default App
