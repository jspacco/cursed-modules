// Generic sidebar wrapper — actual sidebar content is in each page component
export default function Sidebar({ children, style = {} }) {
  return (
    <aside style={style}>
      {children}
    </aside>
  );
}
