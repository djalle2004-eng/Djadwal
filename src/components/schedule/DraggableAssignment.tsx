import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableAssignmentProps {
    id: string;
    children: React.ReactNode;
    data?: any;
    disabled?: boolean;
}

export const DraggableAssignment: React.FC<DraggableAssignmentProps> = ({ id, children, data, disabled }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        data,
        disabled
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
        cursor: disabled ? 'default' : 'grab',
        touchAction: 'none', // Required for pointer events
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="h-full w-full">
            {children}
        </div>
    );
};
