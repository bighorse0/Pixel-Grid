'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import GridCanvas from '@/components/GridCanvas'
import { gridAPI, paymentsAPI } from '@/lib/api'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function Home() {
  const searchParams = useSearchParams()
  const [blocks, setBlocks] = useState([])
  const [step, setStep] = useState<'select' | 'details' | 'upload' | 'checkout'>('select')
  const [selection, setSelection] = useState<any>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [price, setPrice] = useState(0)
  const [currentBlock, setCurrentBlock] = useState<any>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [hoverTitle, setHoverTitle] = useState('')
  const [hoverDescription, setHoverDescription] = useState('')
  const [hoverCta, setHoverCta] = useState('')

  // Handle URL parameters for redirects (e.g., from test checkout)
  useEffect(() => {
    const stepParam = searchParams.get('step')
    const blockIdParam = searchParams.get('block_id')
    const editTokenParam = searchParams.get('edit_token')

    if (stepParam && blockIdParam) {
      // Fetch the block details
      gridAPI.getBlock(blockIdParam).then((block) => {
        setCurrentBlock({
          ...block,
          edit_token: editTokenParam || block.edit_token
        })
        setLinkUrl(block.link_url || '')
        setStep(stepParam as any)
      }).catch((error) => {
        console.error('Failed to fetch block:', error)
        alert('Failed to load block. Please try again.')
      })
    }
  }, [searchParams])

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
    if (!linkUrl || !selection) return

    // Ensure URL has a protocol
    let normalizedUrl = linkUrl.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    try {
      const block = await gridAPI.reserveBlock({
        x_start: selection.x,
        y_start: selection.y,
        width: selection.width,
        height: selection.height,
        link_url: normalizedUrl,
      })

      setCurrentBlock(block)
      setStep('upload')
    } catch (error) {
      console.error('Failed to reserve block:', error)
      alert('Failed to reserve block. Please try again.')
    }
  }

  const handleUpload = async () => {
    if (!currentBlock || !imageFile) return

    try {
      await gridAPI.uploadImage(
        currentBlock.id,
        currentBlock.edit_token,
        imageFile,
        {
          link_url: linkUrl,
          hover_title: hoverTitle || undefined,
          hover_description: hoverDescription || undefined,
          hover_cta: hoverCta || undefined,
        }
      )
      setStep('checkout')
    } catch (error) {
      console.error('Failed to upload image:', error)
      alert('Failed to upload image. Please try again.')
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
          {['select', 'details', 'upload', 'checkout'].map((s, i) => (
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
                <label className="block text-sm font-bold mb-2">Link URL</label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blox-gray rounded-lg focus:border-blox-blue focus:outline-none"
                  placeholder="yourwebsite.com or https://yourwebsite.com"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Your block will link to this URL when clicked. No need to include https://
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
                  disabled={!linkUrl}
                  className="btn-blox-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && currentBlock && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Upload Your Image</h2>
            <div className="card-blox mb-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Upload your image before payment. Your image will be reviewed and must meet our content guidelines.
                </p>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span>Block Size:</span>
                    <span className="font-mono">{currentBlock.width}x{currentBlock.height}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Link URL:</span>
                    <span className="font-mono text-xs break-all">{linkUrl}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Image File</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border-2 border-blox-gray rounded-lg focus:border-blox-blue focus:outline-none"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Upload an image that fits your {currentBlock.width}x{currentBlock.height} block. Max 5MB.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Hover Title (Optional)</label>
                <input
                  type="text"
                  value={hoverTitle}
                  onChange={(e) => setHoverTitle(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blox-gray rounded-lg focus:border-blox-blue focus:outline-none"
                  placeholder="Brief title shown on hover"
                  maxLength={100}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Hover Description (Optional)</label>
                <textarea
                  value={hoverDescription}
                  onChange={(e) => setHoverDescription(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blox-gray rounded-lg focus:border-blox-blue focus:outline-none"
                  placeholder="Description shown on hover"
                  maxLength={255}
                  rows={3}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Call-to-Action (Optional)</label>
                <input
                  type="text"
                  value={hoverCta}
                  onChange={(e) => setHoverCta(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blox-gray rounded-lg focus:border-blox-blue focus:outline-none"
                  placeholder="e.g., 'Visit Site', 'Learn More'"
                  maxLength={50}
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('details')}
                  className="btn-blox-secondary flex-1"
                >
                  Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!imageFile}
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
                Your image has been uploaded and is being reviewed! Click below to complete payment via Stripe.
              </p>
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✓ Image uploaded successfully
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Your block will appear on the grid once payment is complete and moderation is approved.
                </p>
              </div>
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
