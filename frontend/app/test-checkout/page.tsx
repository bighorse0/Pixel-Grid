'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { paymentsAPI } from '@/lib/api'

export default function TestCheckout() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing test payment...')

  useEffect(() => {
    const completePayment = async () => {
      const blockId = searchParams.get('block_id')
      if (!blockId) {
        setStatus('error')
        setMessage('No block ID provided')
        return
      }

      try {
        await paymentsAPI.completeTestPayment(blockId)
        setStatus('success')
        setMessage('Test payment completed successfully!')

        // Redirect to home page after 2 seconds
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } catch (error) {
        console.error('Test payment failed:', error)
        setStatus('error')
        setMessage('Test payment failed. Please try again.')
      }
    }

    completePayment()
  }, [searchParams, router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card-blox max-w-md w-full text-center">
        <div className="mb-6">
          {status === 'processing' && (
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blox-blue"></div>
          )}
          {status === 'success' && (
            <div className="text-6xl">✅</div>
          )}
          {status === 'error' && (
            <div className="text-6xl">❌</div>
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {status === 'processing' && 'Processing Payment'}
          {status === 'success' && 'Payment Successful!'}
          {status === 'error' && 'Payment Failed'}
        </h1>
        <p className="text-gray-600">{message}</p>
        {status === 'success' && (
          <p className="text-sm text-gray-500 mt-4">
            Your block will appear on the grid once approved! Redirecting to home...
          </p>
        )}
        {status === 'error' && (
          <button
            onClick={() => router.push('/')}
            className="btn-blox-primary mt-6"
          >
            Return Home
          </button>
        )}
      </div>
    </main>
  )
}
