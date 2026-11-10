import { formatNumber } from '../lib/format';

interface SeatStatsProps {
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

/** Total / held / confirmed / available seats plus an occupancy bar. */
export function SeatStats({ totalSeats, heldSeats, confirmedSeats, availableSeats }: SeatStatsProps) {
  const confirmedPct = totalSeats > 0 ? (confirmedSeats / totalSeats) * 100 : 0;
  const heldPct = totalSeats > 0 ? (heldSeats / totalSeats) * 100 : 0;

  return (
    <div className="seats">
      <dl className="seats__grid">
        <div className="seat seat--total">
          <dt>মোট seat</dt>
          <dd>{formatNumber(totalSeats)}</dd>
        </div>
        <div className="seat seat--held">
          <dt>Hold-এ আছে</dt>
          <dd>{formatNumber(heldSeats)}</dd>
        </div>
        <div className="seat seat--confirmed">
          <dt>নিশ্চিত</dt>
          <dd>{formatNumber(confirmedSeats)}</dd>
        </div>
        <div className="seat seat--available">
          <dt>খালি</dt>
          <dd>{formatNumber(availableSeats)}</dd>
        </div>
      </dl>
      <div
        className="bar"
        role="img"
        aria-label={`${formatNumber(totalSeats)} seat-এর মধ্যে ${formatNumber(confirmedSeats)} নিশ্চিত, ${formatNumber(heldSeats)} hold-এ`}
      >
        <span className="bar__confirmed" style={{ width: `${confirmedPct}%` }} />
        <span className="bar__held" style={{ width: `${heldPct}%` }} />
      </div>
    </div>
  );
}
