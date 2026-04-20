import { avSrc, inits } from '../../lib/api'

export default function Avatar({ user, size = 35, className = '' }) {
  const src = avSrc(user)
  const style = { width: size, height: size, fontSize: Math.floor(size * 0.35) }
  return (
    <div className={`ci-av ${className}`} style={style}>
      {src
        ? <img src={src} alt="" />
        : <span>{inits(user)}</span>
      }
    </div>
  )
}
