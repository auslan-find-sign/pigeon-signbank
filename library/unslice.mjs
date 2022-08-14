// to workaround v8 https://bugs.chromium.org/p/v8/issues/detail?id=2869 causing massive catastrophic memory leak
export default function unslice (str) {
  return (' ' + str).substring(1)
}
