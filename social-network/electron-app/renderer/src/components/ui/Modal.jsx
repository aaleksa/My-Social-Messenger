export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}
