import AppKit
import Foundation
// Native vector mark, rasterized for Electron's desktop icon pipeline.
let size=1024
let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
func color(_ hex:UInt32)->NSColor {NSColor(srgbRed:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1)}
color(0xf5f4f0).setFill()
NSBezierPath(roundedRect:NSRect(x:0,y:0,width:size,height:size),xRadius:215,yRadius:215).fill()
for (x,y,w,h,c) in [(208,256,176,480,UInt32(0x4f83cf)),(432,256,176,576,UInt32(0xd0a536)),(656,256,176,384,UInt32(0xcf6658))] {color(c).setFill();NSBezierPath(roundedRect:NSRect(x:x,y:y,width:w,height:h),xRadius:48,yRadius:48).fill()}
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[1]))
