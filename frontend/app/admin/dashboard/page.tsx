'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { moderationAPI, adminAPI } from '@/lib/api'

export default function AdminDashboard() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [pendingBlocks, setPendingBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [adminData, pending] = await Promise.all([
        adminAPI.getMe(),
        moderationAPI.getPendingBlocks(),
      ])
      setAdmin(adminData)
      setPendingBlocks(pending)
    } catch (error) {
      console.error('Failed to load data:', error)
      router.push('/admin/login')
    } finally {
      setLoading(false)
    }
  }

  const handleDecision = async (blockId: string, decision: 'approve' | 'reject', reason?: string) => {
    try {
      await moderationAPI.decideBlock(blockId, decision, reason)
      await loadData()
      setSelectedBlock(null)
      alert(`Block ${decision}d successfully`)
    } catch (error) {
      console.error('Failed to moderate block:', error)
      alert('Failed to moderate block')
    }
  }

  const handleBanDomain = async (domain: string, reason: string) => {
    try {
      await moderationAPI.banDomain(domain, reason)
      alert(`Domain ${domain} banned successfully`)
    } catch (error) {
      console.error('Failed to ban domain:', error)
      alert('Failed to ban domain')
    }
  }

  const handleBanImageHash = async (imageHash: string, reason: string) => {
    try {
      await moderationAPI.banImageHash(imageHash, reason)
      await loadData()
      alert('Image hash banned successfully')
    } catch (error) {
      console.error('Failed to ban image hash:', error)
      alert('Failed to ban image hash')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    router.push('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blox-light">
      {/* Header */}
      <div className="bg-blox-dark text-white py-6 mb-8">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-gray-400">
              Logged in as {admin?.email} ({admin?.role})
            </p>
          </div>
          <button onClick={handleLogout} className="btn-blox-danger">
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card-blox">
            <div className="text-sm text-gray-600 mb-1">Pending Review</div>
            <div className="text-3xl font-bold text-blox-red">{pendingBlocks.length}</div>
          </div>
          <div className="card-blox">
            <div className="text-sm text-gray-600 mb-1">Your Role</div>
            <div className="text-3xl font-bold text-blox-blue capitalize">{admin?.role}</div>
          </div>
          <div className="card-blox">
            <div className="text-sm text-gray-600 mb-1">2FA Status</div>
            <div className="text-3xl font-bold text-blox-green">
              {admin?.two_fa_enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>

        {/* Pending blocks */}
        <div className="card-blox">
          <h2 className="text-2xl font-bold mb-6">Pending Moderation</h2>

          {pendingBlocks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No blocks pending review
            </div>
          ) : (
            <div className="space-y-4">
              {pendingBlocks.map((item) => (
                <div
                  key={item.block.id}
                  className="border-2 border-blox-gray rounded-lg p-4 hover:border-blox-blue transition-colors"
                >
                  <div className="flex gap-4">
                    {/* Image preview */}
                    <div className="flex-shrink-0">
                      {item.image?.image_url && (
                        <img
                          src={item.image.image_url}
                          alt="Block preview"
                          className="w-32 h-32 object-cover rounded border-2 border-blox-gray"
                        />
                      )}
                    </div>

                    {/* Block info */}
                    <div className="flex-grow">
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-gray-600">Position:</span>{' '}
                          <span className="font-mono">
                            ({item.block.x_start}, {item.block.y_start})
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Size:</span>{' '}
                          <span className="font-mono">
                            {item.block.width}x{item.block.height}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Buyer:</span>{' '}
                          <span className="font-mono">{item.block.buyer_email}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Link:</span>{' '}
                          <a
                            href={item.image?.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blox-blue hover:underline"
                          >
                            {item.image?.link_url}
                          </a>
                        </div>
                      </div>

                      {/* Moderation flags */}
                      {item.moderation_checks && item.moderation_checks.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-bold mb-2">Moderation Flags:</div>
                          <div className="space-y-1">
                            {item.moderation_checks
                              .filter((check: any) => check.flagged)
                              .map((check: any, i: number) => (
                                <div
                                  key={i}
                                  className="text-xs bg-blox-red text-white px-2 py-1 rounded inline-block mr-2"
                                >
                                  {check.check_type}:{' '}
                                  {check.flagged_categories?.join(', ') || 'flagged'}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleDecision(item.block.id, 'approve', 'Manually approved')
                          }
                          className="btn-blox-secondary text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Rejection reason:')
                            if (reason) {
                              handleDecision(item.block.id, 'reject', reason)
                            }
                          }}
                          className="btn-blox-danger text-sm"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            const domain = new URL(item.image.link_url).hostname
                            const reason = prompt(`Ban domain ${domain}? Reason:`)
                            if (reason) {
                              handleBanDomain(domain, reason)
                            }
                          }}
                          className="btn-blox text-sm bg-blox-yellow"
                        >
                          Ban Domain
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Ban this image hash? Reason:')
                            if (reason) {
                              handleBanImageHash(item.image.image_hash, reason)
                            }
                          }}
                          className="btn-blox text-sm bg-blox-yellow"
                        >
                          Ban Image
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
