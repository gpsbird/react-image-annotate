// @flow

import React, { useState, useEffect, useMemo, useRef } from "react"

import MMGC_INIT from "mmgc1-cpp"

export default ({
  classPoints,
  regionClsList,
  imageSrc,
  imagePosition,
  opacity = 0.5,
  zIndex = 2,
  position = "absolute",
}) => {
  if (!window.mmgc) window.mmgc = MMGC_INIT()
  const mmgc = window.mmgc
  const [canvasRef, setCanvasRef] = useState(null)

  const lastTimeMMGCRun = useRef(0)
  const superPixelsGenerated = useRef(false)
  const [sampleImageData, setSampleImageData] = useState()

  useEffect(() => {
    if (!imageSrc) return
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    const image = new Image()
    image.crossOrigin = "anonymous"
    image.src = imageSrc
    image.onload = () => {
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      ctx.drawImage(image, 0, 0)
      const imageData = ctx.getImageData(
        0,
        0,
        image.naturalWidth,
        image.naturalHeight
      )
      superPixelsGenerated.current = false
      setSampleImageData(imageData)
    }
  }, [imageSrc])

  useEffect(() => {
    if (!canvasRef) return
    if (!sampleImageData) return
    if (classPoints.filter((cp) => cp.cls).length < 3) return
    if (!mmgc.setImageSize) return
    // NEEDS DEBOUNCE
    if (Date.now() < lastTimeMMGCRun.current + 500) return
    lastTimeMMGCRun.current = Date.now()
    const context = canvasRef.getContext("2d")

    if (!superPixelsGenerated.current) {
      superPixelsGenerated.current = "processing"
      mmgc.setImageSize(sampleImageData.width, sampleImageData.height)
      const imageAddress = mmgc.getImageAddr()
      mmgc.HEAPU8.set(sampleImageData.data, imageAddress)
      mmgc.computeSuperPixels()
      superPixelsGenerated.current = "done"
    }
    if (superPixelsGenerated.current !== "done") return

    mmgc.setClassColor(0, 0xff0000ff)
    mmgc.setClassColor(1, 0xffff00ff)
    mmgc.setClassColor(2, 0xff00ffff)
    // mmgc.setVerboseMode(true)
    mmgc.clearClassPoints()
    for (const classPoint of classPoints) {
      if (!classPoint.cls) continue
      if (classPoint.x < 0) continue
      mmgc.addClassPoint(
        regionClsList.indexOf(classPoint.cls),
        Math.floor(classPoint.y * sampleImageData.height),
        Math.floor(classPoint.x * sampleImageData.width)
      )
    }
    mmgc.computeMasks()
    const maskAddress = mmgc.getColoredMask()
    const cppImDataUint8 = new Uint8ClampedArray(
      mmgc.HEAPU8.buffer,
      maskAddress,
      sampleImageData.data.length
      // sampleImageData.width * sampleImageData.height * 4
    )
    const maskImageData = new ImageData(
      cppImDataUint8,
      sampleImageData.width,
      sampleImageData.height
    )

    context.clearRect(0, 0, sampleImageData.width, sampleImageData.height)
    context.putImageData(maskImageData, 0, 0)
  }, [
    canvasRef,
    sampleImageData,
    JSON.stringify(classPoints.map((c) => [c.x, c.y, c.cls])),
  ])

  const style = useMemo(() => {
    let width = imagePosition.bottomRight.x - imagePosition.topLeft.x
    let height = imagePosition.bottomRight.y - imagePosition.topLeft.y
    return {
      imageRendering: "pixelated",
      left: imagePosition.topLeft.x,
      top: imagePosition.topLeft.y,
      width: isNaN(width) ? 0 : width,
      height: isNaN(height) ? 0 : height,
      zIndex,
      position,
      opacity,
      pointerEvents: "none",
    }
  }, [
    imagePosition.topLeft.x,
    imagePosition.topLeft.y,
    imagePosition.bottomRight.x,
    imagePosition.bottomRight.y,
    zIndex,
    position,
    opacity,
  ])

  return (
    <canvas
      style={style}
      width={sampleImageData ? sampleImageData.width : 0}
      height={sampleImageData ? sampleImageData.height : 0}
      ref={setCanvasRef}
    />
  )
}