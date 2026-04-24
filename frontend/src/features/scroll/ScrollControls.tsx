export const ScrollControls = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  };

  return (
    <>
      <button type="button" className="scroll-control scroll-control-top" onClick={scrollToTop}>
        TOP
      </button>
      <button type="button" className="scroll-control scroll-control-bottom" onClick={scrollToBottom}>
        BOTTOM
      </button>
    </>
  );
};
