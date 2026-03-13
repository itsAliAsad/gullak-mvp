import { useState, useCallback, useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { Home } from '@/screens/Home'
import { About } from '@/screens/About'
import { Team } from '@/screens/Team'
import { Dashboard } from '@/screens/Dashboard'
import { Landing } from '@/screens/Landing'
import { getAnalysisProgress, subscribeToAnalysisProgress } from '@/lib/api'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  const [page, setPage]                   = useState('landing')
  const [screen, setScreen]               = useState('chat')   // 'chat' | 'analyzing' | 'dashboard'
  const [sessionId, setSessionId]         = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [analysisProgress, setAnalysisProgress] = useState([])

  const handleNavigate    = useCallback((target) => setPage(target), [])
  const handleSessionId   = useCallback((sid) => setSessionId(sid), [])
  const handleRevertToChat = useCallback(() => {
    setAnalysisProgress([])
    setScreen('chat')
  }, [])
  const handleProfilingComplete = useCallback(() => {
    setAnalysisProgress([])
    setScreen('analyzing')
  }, [])

  const handleConversing = useCallback((response) => {
    setSessionId(response.session_id)
    setScreen(prev => {
      if (prev === 'analyzing') {
        setDashboardData(response)
        return 'dashboard'
      }
      setTimeout(() => {
        setDashboardData(response)
        setScreen('dashboard')
      }, 4000)
      return 'analyzing'
    })
  }, [])

  const handleReanalysis = useCallback((response) => setDashboardData(response), [])

  const handleReset = useCallback(() => {
    setAnalysisProgress([])
    setDashboardData(null)
    setSessionId(null)
    setScreen('chat')
  }, [])

  useEffect(() => {
    if (screen !== 'analyzing' || !sessionId || dashboardData) return

    let cancelled = false
    let timerId = null
    let stopSocket = null
    let pollingStarted = false

    const startPolling = () => {
      if (pollingStarted || cancelled) return
      pollingStarted = true

      const poll = async () => {
        try {
          const response = await getAnalysisProgress(sessionId)
          if (!cancelled) {
            setAnalysisProgress(Array.isArray(response.progress) ? response.progress : [])
          }
        } catch (error) {
          if (!cancelled) {
            console.error('Analysis progress error:', error)
          }
        } finally {
          if (!cancelled) {
            timerId = window.setTimeout(poll, 1200)
          }
        }
      }

      poll()
    }

    stopSocket = subscribeToAnalysisProgress(sessionId, {
      onProgress: (payload) => {
        if (!cancelled) {
          setAnalysisProgress(Array.isArray(payload.progress) ? payload.progress : [])
        }
      },
      onClose: () => {
        startPolling()
      },
      onError: (error) => {
        if (!cancelled) {
          console.error('Analysis WebSocket error:', error)
        }
        startPolling()
      },
    })

    if (!stopSocket) {
      startPolling()
    }

    return () => {
      cancelled = true
      stopSocket?.()
      if (timerId) window.clearTimeout(timerId)
    }
  }, [screen, sessionId, dashboardData])

  const sidebarScreen = page === 'home' ? screen : 'chat'

  const renderContent = () => {
    if (page === 'landing') return <Landing onStart={() => setPage('home')} />
    if (page === 'about') return <About onTryGullak={() => setPage('home')} />
    if (page === 'team')  return <Team />

    const showHome      = screen === 'chat' || (screen === 'analyzing' && !dashboardData)
    const showDashboard = screen === 'dashboard'

    return (
      <>
        <div className={showHome ? 'h-full' : 'hidden'}>
          <Home
            sessionId={sessionId}
            onSessionId={handleSessionId}
            onConversing={handleConversing}
            onProfilingComplete={handleProfilingComplete}
            onRevertToChat={handleRevertToChat}
            isAnalyzing={screen === 'analyzing' && !dashboardData}
            progressEvents={analysisProgress}
          />
        </div>
        {showDashboard && (
          <Dashboard
            data={dashboardData}
            sessionId={sessionId}
            onReanalysis={handleReanalysis}
            onReset={handleReset}
          />
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col h-dvh">
      <Toaster />
      {page !== 'landing' && <Navbar currentPage={page} onNavigate={handleNavigate} />}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {page !== 'landing' && <Sidebar screen={sidebarScreen} />}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
