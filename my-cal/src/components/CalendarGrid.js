import PlayBoard from './PlayBoard';

const CalendarGrid = ({ customGameData }) => {
  return (
    <div className="calendar-grid-container">
      <PlayBoard customGameData={customGameData} />
    </div>
  );
};

export default CalendarGrid;