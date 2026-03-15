import { useEffect, useRef} from 'react';
import { Chessground } from 'chessground';

import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';

interface Props {
  width?: number;
  height?: number;
  contained?: boolean;
  config?: Config;
  onReady?: (api: Api) => void;
}

const Chessboard = ({
  width = 600,
  height = 600,
  config = {},
  contained = false,
  onReady,
}: Props) => {
  const apiRef = useRef<Api | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !apiRef.current) {
      apiRef.current = Chessground(containerRef.current, {
        animation: { enabled: true, duration: 200 },
        ...config,
      });
      onReady?.(apiRef.current);
    }
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ height: contained ? '100%' : height, width: contained ? '100%' : width }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%', display: 'table' }} />
    </div>
  );
};

export default Chessboard;
