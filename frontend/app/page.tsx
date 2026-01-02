'use client'

import { useEffect, useState } from 'react'
import GridCanvas from '@/components/GridCanvas'
import { gridAPI, paymentsAPI } from '@/lib/api'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function Home() {
  const [blocks, setBlocks] = useState([])
  const [step, setStep] = useState<'select' | 'details' | 'checkout' | 'upload'>('select')
  const [selection, setSelection] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [price, setPrice] = useState(0)
  const [currentBlock, setCurrentBlock] = useState<any>(null)

  // Load grid state
  useEffect(() => {
    loadGrid()
  }, [])

  const loadGrid = async () => {
    try {
      const data = await gridAPI.getGridState()
      setBlocks(data)
    } catch (error) {
      console.error('Failed to load grid:', error)
    }
  }

  const handleSelection = (sel: any) => {
    setSelection(sel)
    // Calculate estimated price locally (backend will verify)
    const pixelCount = sel.width * sel.height
    setPrice(pixelCount * 1.00) // $1 per pixel
  }

  const handleBuyPixels = async () => {
    if (!selection) return

    try {
      const availability = await gridAPI.checkAvailability({
        x_start: selection.x,
        y_start: selection.y,
        width: selection.width,
        height: selection.height,
      })

      if (availability.available) {
        setPrice(Number(availability.total_price))
        setStep('details')
      } else {
        alert('This area is not available. Please select a different area.')
      }
    } catch (error) {
      console.error('Failed to check availability:', error)
      alert('Failed to check availability. Please try again.')
    }
  }

  const handleReserve = async () => {
    if (!email || !linkUrl || !selection) return

    try {
      const block = await gridAPI.reserveBlock({
        x_start: selection.x,
        y_start: selection.y,
        width: selection.width,
        height: selection.height,
        buyer_email: email,
        link_url: linkUrl,
      })

      setCurrentBlock(block)
      setStep('checkout')
    } catch (error) {
      console.error('Failed to reserve block:', error)
      alert('Failed to reserve block. Please try again.')
    }
  }

  const handleCheckout = async () => {
    if (!currentBlock) return

    try {
      const { url } = await paymentsAPI.createCheckoutSession(currentBlock.id)
      window.location.href = url
    } catch (error) {
      console.error('Failed to create checkout session:', error)
      alert('Failed to create checkout session. Please try again.')
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <div className="text-white py-4 relative overflow-hidden">
        {/* Roblox-style repeating color blocks */}
        <div className="absolute inset-0 flex">
          {[...Array(60)].map((_, i) => {
            const colors = ['#C1191F', '#E2231A', '#FF2D2D']
            return (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: colors[i % 3] }}
              />
            )
          })}
        </div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-1">
                BloxGrid
              </h1>
              <p className="text-sm opacity-90">
                Own your block on the grid. Upload your image. Be part of history.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-black bg-opacity-30 backdrop-blur-sm px-4 py-2 rounded">
                <div className="text-xl font-bold">1,000,000</div>
                <div className="text-xs opacity-90">Total Pixels</div>
              </div>
              <div className="bg-black bg-opacity-30 backdrop-blur-sm px-4 py-2 rounded">
                <div className="text-xl font-bold">{blocks.length}</div>
                <div className="text-xs opacity-90">Blocks Sold</div>
              </div>
              <div className="bg-black bg-opacity-30 backdrop-blur-sm px-4 py-2 rounded">
                <div className="text-xl font-bold">$1.00</div>
                <div className="text-xs opacity-90">Per Pixel</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Step indicator */}
        <div className="mb-8 flex justify-center gap-4">
          {['select', 'details', 'checkout', 'upload'].map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-2 ${
                step === s ? 'text-blox-blue font-bold' : 'text-gray-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === s ? 'bg-blox-blue text-white' : 'bg-gray-300'
                }`}
              >
                {i + 1}
              </div>
              <span className="capitalize">{s}</span>
            </div>
          ))}
        </div>

        {/* Step: Select */}
        {step === 'select' && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Select Your Block</h2>
            <p className="text-gray-600 mb-6">
              Drag on the grid to select your block. Minimum size: 10x10 pixels.
            </p>
            <GridCanvas blocks={blocks} onSelect={handleSelection} selectionMode={true} />

            {selection && (
              <div className="mt-6 max-w-xl mx-auto">
                <div className="card-blox">
                  <div className="mb-4">
                    <h3 className="font-bold mb-2">Selection Details</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Position:</span>
                        <span className="font-mono">({selection.x}, {selection.y})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span className="font-mono">{selection.width}x{selection.height}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Pixels:</span>
                        <span className="font-mono">{selection.width * selection.height}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg text-blox-blue">
                        <span>Estimated Price:</span>
                        <span>${price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleBuyPixels}
                    className="btn-blox-primary w-full"
                  >
                    Buy Pixels
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Details */}
        {step === 'details' && selection && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Confirm Your Details</h2>
            <div className="card-blox mb-6">
              <h3 className="font-bold mb-4">Block Details</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span>Position:</span>
                  <span className="font-mono">({selection.x}, {selection.y})</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="font-mono">{selection.width}x{selection.height}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Pixels:</span>
                  <span className="font-mono">{selection.width * selection.height}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-blox-blue">
                  <span>Total Price:</span>
                  <span>${price.toFixed(2)}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Your Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blox-gray rounded-lg focus:border-blox-blue focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  We'll send your edit token here. No account needed.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Link URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blox-gray rounded-lg focus:border-blox-blue focus:outline-none"
                  placeholder="https://yourwebsite.com"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Your block will link to this URL when clicked.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('select')}
                  className="btn-blox-secondary flex-1"
                >
                  Back
                </button>
                <button
                  onClick={handleReserve}
                  disabled={!email || !linkUrl}
                  className="btn-blox-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Checkout */}
        {step === 'checkout' && currentBlock && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Complete Payment</h2>
            <div className="card-blox mb-6">
              <p className="mb-4">
                Your block has been reserved! Click below to complete payment via Stripe.
              </p>
              <button onClick={handleCheckout} className="btn-blox-primary w-full">
                Pay ${price.toFixed(2)}
              </button>
            </div>
          </div>
        )}

        {/* Info section */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="card-blox text-center">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="font-bold text-xl mb-2">Roblox-Style</h3>
            <p className="text-sm text-gray-600">
              Blocky, vibrant aesthetics inspired by your favorite games.
            </p>
          </div>
          <div className="card-blox text-center">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="font-bold text-xl mb-2">Auto-Moderation</h3>
            <p className="text-sm text-gray-600">
              AI-powered safety checks keep the grid clean and safe.
            </p>
          </div>
          <div className="card-blox text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="font-bold text-xl mb-2">Secure Payments</h3>
            <p className="text-sm text-gray-600">
              All transactions secured by Stripe. No credit card data stored.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
