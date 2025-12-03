import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableCellProps {
    id: string;
    children: React.ReactNode;
    data?: any;
    isValid?: boolean; // For conflict detection styling
    isOver?: boolean;  // Passed from parent or calculated here if we move logic
    disabled?: boolean;
}

export const DroppableCell: React.FC<DroppableCellProps> = ({ id, children, data, isValid, disabled }) => {
    const { setNodeRef, isOver } = useDroppable({
        id,
        data,
        disabled
    });

    let backgroundColor = '';
    if (isOver && !disabled) {
        backgroundColor = isValid === false ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'; // Red or Green tint
    }

    const style = {
        backgroundColor,
        transition: 'background-color 0.2s ease',
    };

    return (
        <div ref={setNodeRef} style={style} className="h-full w-full relative">
            {children}
        </div>
    );
};
