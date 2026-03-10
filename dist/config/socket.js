import { Server } from 'socket.io';
let io;
export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust for production
            methods: ["GET", "POST"]
        }
    });
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        socket.on('join-store', (storeId) => {
            socket.join(storeId);
            console.log(`User ${socket.id} joined store room: ${storeId}`);
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
    return io;
};
export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};
export const emitToStore = (storeId, event, data) => {
    if (io) {
        io.to(storeId).emit(event, data);
    }
};
