'use client'

import { useEffect, useRef, useState } from 'react'

interface Block {
  id: string
  x_start: number
  y_start: number
  width: number
  height: number
  image_url?: string
  link_url?: string
  hover_title?: string
  hover_description?: string
  hover_cta?: string
}

interface GridCanvasProps {
  blocks: Block[]
  onSelect?: (selection: { x: number; y: number; width: number; height: number }) => void
  selectionMode?: boolean
}

const GRID_SIZE = 1000
const MIN_BLOCK_SIZE = 10

export default function GridCanvas({ blocks, onSelect, selectionMode = false }: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map())
  const [scale, setScale] = useState(1)
  const [autoScale, setAutoScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [hoveredBlock, setHoveredBlock] = useState<Block | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [imagesLoaded, setImagesLoaded] = useState(0)

  // Preload images when blocks change
  useEffect(() => {
    let loadedCount = 0
    const cache = imageCache.current

    blocks.forEach((block) => {
      if (block.image_url && !cache.has(block.image_url)) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          loadedCount++
          setImagesLoaded(loadedCount)
        }
        img.src = block.image_url
        cache.set(block.image_url, img)
      }
    })
  }, [blocks])

  // Calculate auto-scale to fit container
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = containerRef.current.clientHeight
        const minDimension = Math.min(containerWidth, containerHeight)
        const newAutoScale = (minDimension - 8) / GRID_SIZE // 8px for border
        setAutoScale(newAutoScale)
      }
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const snapToGrid = (value: number) => Math.floor(value / MIN_BLOCK_SIZE) * MIN_BLOCK_SIZE

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const totalScale = autoScale * scale
    const x = Math.floor((e.clientX - rect.left) / totalScale)
    const y = Math.floor((e.clientY - rect.top) / totalScale)

    return {
      x: Math.max(0, Math.min(GRID_SIZE, snapToGrid(x))),
      y: Math.max(0, Math.min(GRID_SIZE, snapToGrid(y))),
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectionMode) return

    const pos = getCanvasCoordinates(e)
    setStartPos(pos)
    setIsDragging(true)
    setSelection(null)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoordinates(e)
    setMousePos(pos)

    if (selectionMode && isDragging && startPos) {
      const width = Math.max(MIN_BLOCK_SIZE, snapToGrid(Math.abs(pos.x - startPos.x)))
      const height = Math.max(MIN_BLOCK_SIZE, snapToGrid(Math.abs(pos.y - startPos.y)))
      const x = Math.min(startPos.x, pos.x)
      const y = Math.min(startPos.y, pos.y)

      setSelection({ x, y, width, height })
    } else {
      // Check if hovering over a block
      const block = blocks.find(
        (b) =>
          pos.x >= b.x_start &&
          pos.x < b.x_start + b.width &&
          pos.y >= b.y_start &&
          pos.y < b.y_start + b.height
      )
      setHoveredBlock(block || null)
    }
  }

  const handleMouseUp = () => {
    if (isDragging && selection && onSelect) {
      onSelect(selection)
    }
    setIsDragging(false)
  }

  const handleBlockClick = (block: Block) => {
    if (block.link_url && !selectionMode) {
      window.open(block.link_url, '_blank')
    }
  }

  // Draw grid and blocks
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE)

    // Draw grid lines (every 10px)
    ctx.strokeStyle = '#e5e5e5'
    ctx.lineWidth = 1

    for (let i = 0; i <= GRID_SIZE; i += MIN_BLOCK_SIZE) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, GRID_SIZE)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(GRID_SIZE, i)
      ctx.stroke()
    }

    // Draw blocks with images
    blocks.forEach((block) => {
      if (block.image_url) {
        const cachedImg = imageCache.current.get(block.image_url)
        if (cachedImg && cachedImg.complete) {
          ctx.drawImage(cachedImg, block.x_start, block.y_start, block.width, block.height)

          // Draw border
          ctx.strokeStyle = hoveredBlock?.id === block.id ? '#0066ff' : '#393b3d'
          ctx.lineWidth = hoveredBlock?.id === block.id ? 3 : 1
          ctx.strokeRect(block.x_start, block.y_start, block.width, block.height)
        }
      } else {
        // Placeholder for blocks without images
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(block.x_start, block.y_start, block.width, block.height)
        ctx.strokeStyle = '#d0d0d0'
        ctx.lineWidth = 1
        ctx.strokeRect(block.x_start, block.y_start, block.width, block.height)
      }
    })

    // Draw selection
    if (selection) {
      ctx.fillStyle = 'rgba(0, 102, 255, 0.2)'
      ctx.fillRect(selection.x, selection.y, selection.width, selection.height)
      ctx.strokeStyle = '#0066ff'
      ctx.lineWidth = 3
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height)
    }

    // Draw crosshair in selection mode
    if (selectionMode && !isDragging) {
      ctx.strokeStyle = '#0066ff'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])

      ctx.beginPath()
      ctx.moveTo(mousePos.x, 0)
      ctx.lineTo(mousePos.x, GRID_SIZE)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, mousePos.y)
      ctx.lineTo(GRID_SIZE, mousePos.y)
      ctx.stroke()

      ctx.setLineDash([])
    }
  }, [blocks, selection, hoveredBlock, selectionMode, isDragging, mousePos, imagesLoaded])

  const totalScale = autoScale * scale

  return (
    <div className="relative">
      <div className="mb-4 flex gap-4 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setScale(Math.min(2, scale + 0.1))}
            className="btn-blox-primary text-sm"
          >
            Zoom In
          </button>
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="btn-blox-primary text-sm"
          >
            Zoom Out
          </button>
          <button onClick={() => setScale(1)} className="btn-blox-secondary text-sm">
            Fit to Screen
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Zoom: {Math.round(scale * 100)}%
        </div>
      </div>

      <div
        ref={containerRef}
        className="border-4 border-blox-gray rounded-lg overflow-auto bg-white shadow-blox w-full aspect-square max-h-[80vh]"
      >
        <canvas
          ref={canvasRef}
          width={GRID_SIZE}
          height={GRID_SIZE}
          style={{
            transform: `scale(${totalScale})`,
            transformOrigin: 'top left',
            display: 'block'
          }}
          className={
            selectionMode
              ? 'cursor-crosshair'
              : hoveredBlock?.link_url
                ? 'cursor-pointer'
                : 'cursor-default'
          }
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsDragging(false)}
          onClick={() => hoveredBlock && handleBlockClick(hoveredBlock)}
        />
      </div>

      {/* Hover card */}
      {hoveredBlock && hoveredBlock.hover_title && !selectionMode && (
        <div className="absolute top-4 right-4 card-blox max-w-sm">
          <h3 className="font-bold text-lg mb-2">{hoveredBlock.hover_title}</h3>
          {hoveredBlock.hover_description && (
            <p className="text-sm text-gray-600 mb-3">{hoveredBlock.hover_description}</p>
          )}
          {hoveredBlock.hover_cta && (
            <button className="btn-blox-primary text-sm w-full">
              {hoveredBlock.hover_cta}
            </button>
          )}
        </div>
      )}

      {/* Selection info */}
      {selection && (
        <div className="mt-4 card-blox">
          <h3 className="font-bold mb-2">Selection</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Position: ({selection.x}, {selection.y})</div>
            <div>Size: {selection.width}x{selection.height}</div>
            <div>Pixels: {selection.width * selection.height}</div>
          </div>
        </div>
      )}
    </div>
  )
}
