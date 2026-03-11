import { useEffect, useRef, useState } from 'react';
import ChessgroundApi from 'chessground/index';

import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';

interface Props {
  width?: number
  height?: number
  contained?: boolean;
  config?: Config
}

const Chessboard = ({
  width = 900, height = 900, config = {}, contained = false,
}: Props) => {
  const [api, setApi] = useState<Api | null>(null);
  config.events = {
    move: (orig, dest, capturedPiece) => {
      console.log(`Move from ${orig} to ${dest}, captured ${capturedPiece?.role}`);
    }
  };

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref && ref.current && !api) {
      const chessgroundApi = ChessgroundApi(ref.current, {
        animation: { enabled: true, duration: 200 },
        ...config,
      });
      setApi(chessgroundApi);
    } else if (ref && ref.current && api) {
      api.set(config);
    }
  }, [ref]);

  useEffect(() => {
    api?.set(config);
  }, [api, config]);

  return (
    <div style={{ height: contained ? '100%' : height, width: contained ? '100%' : width }}>
      <div ref={ref} style={{ height: '100%', width: '100%', display: 'table' }} />
    </div>
  );
}

export default Chessboard;
