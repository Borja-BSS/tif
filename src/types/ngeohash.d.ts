declare module 'ngeohash' {
  function encode(lat: number, lng: number, precision?: number): string
  function decode(hash: string): { latitude: number; longitude: number }
  function decode_bbox(hash: string): [number, number, number, number]
  function neighbors(hash: string): string[]
  export { encode, decode, decode_bbox, neighbors }
  const ngeohash: {
    encode: typeof encode
    decode: typeof decode
    decode_bbox: typeof decode_bbox
    neighbors: typeof neighbors
  }
  export default ngeohash
}
