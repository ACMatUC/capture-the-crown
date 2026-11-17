const paths = {
  crown: (
    <>
      <path d="m3 6 5 4 4-7 4 7 5-4-3 13H6L3 6Z" />
      <path d="M7 22h10" />
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  code: <path d="m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16" />,
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
