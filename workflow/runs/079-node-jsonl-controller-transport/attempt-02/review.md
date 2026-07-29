PASS

All acceptance criteria are materially satisfied. The prior spawn-failure closure hang is fixed by settling on the child’s definitive `close` event, and the public-boundary regression test covers request rejection, bounded diagnostics, and idempotent closure. The supplied validation passes fully.