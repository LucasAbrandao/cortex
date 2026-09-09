import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState
} from "react";

type IndicatorPosition = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type AnimatedNavigationListProps<ItemId extends string> = {
  activeId: ItemId | null;
  className?: string;
  items: readonly ItemId[];
  renderItem: (item: ItemId) => ReactNode;
};

/**
 * Renders one persistent selection surface that moves between navigation items.
 * The `renderItem` callback keeps this useful for sidebars, tabs, and future
 * navigation groups without coupling it to a specific router.
 */
export function AnimatedNavigationList<ItemId extends string>({
  activeId,
  className,
  items,
  renderItem
}: AnimatedNavigationListProps<ItemId>) {
  const listRef = useRef<HTMLUListElement>(null);
  const [indicatorPosition, setIndicatorPosition] = useState<IndicatorPosition | null>(null);

  const updateIndicator = useCallback(() => {
    const list = listRef.current;
    if (!list || !activeId) {
      setIndicatorPosition(null);
      return;
    }

    const target = Array.from(list.querySelectorAll<HTMLElement>("[data-navigation-item]")).find(
      (element) => element.dataset.navigationItem === activeId
    );
    if (!target) {
      setIndicatorPosition(null);
      return;
    }

    const listBox = list.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    if (targetBox.width === 0 || targetBox.height === 0) {
      setIndicatorPosition(null);
      return;
    }

    setIndicatorPosition({
      height: targetBox.height,
      width: targetBox.width,
      x: targetBox.left - listBox.left,
      y: targetBox.top - listBox.top
    });
  }, [activeId]);

  useLayoutEffect(() => {
    updateIndicator();

    const list = listRef.current;
    if (!list) return;

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateIndicator);
    resizeObserver?.observe(list);
    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeId, updateIndicator]);

  const indicatorStyle = indicatorPosition
    ? ({
        height: `${indicatorPosition.height}px`,
        transform: `translate3d(${indicatorPosition.x}px, ${indicatorPosition.y}px, 0)`,
        width: `${indicatorPosition.width}px`
      } as CSSProperties)
    : undefined;

  return (
    <ul ref={listRef} className={className} data-active-id={activeId ?? undefined}>
      <li
        aria-hidden="true"
        className="nav-selection-indicator"
        data-ready={indicatorPosition ? "true" : undefined}
        role="presentation"
        style={indicatorStyle}
      />
      {items.map((item) => (
        <li data-navigation-item={item} key={item}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
