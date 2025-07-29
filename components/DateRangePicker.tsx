
import React, { useState, useEffect } from 'react';

interface DateRangePickerProps {
    onDateChange: (startDate: string, endDate: string) => void;
    initialStartDate: string;
    initialEndDate: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ onDateChange, initialStartDate, initialEndDate }) => {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);

    useEffect(() => {
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
    }, [initialStartDate, initialEndDate]);

    const handleApply = () => {
        onDateChange(startDate, endDate);
    };

    return (
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 bg-brand-border/30 p-2 rounded-lg">
            <div className="flex items-center gap-2">
                <label htmlFor="startDate" className="text-sm text-brand-text-secondary">Desde:</label>
                <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 text-sm focus:ring-brand-primary focus:border-brand-primary"
                />
            </div>
            <div className="flex items-center gap-2">
                <label htmlFor="endDate" className="text-sm text-brand-text-secondary">Hasta:</label>
                <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 text-sm focus:ring-brand-primary focus:border-brand-primary"
                />
            </div>
            <button
                onClick={handleApply}
                className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm"
            >
                Aplicar
            </button>
        </div>
    );
};