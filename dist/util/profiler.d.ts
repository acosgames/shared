declare const Profiler: {
    debug: boolean;
    constructor: () => void;
    log: () => void;
    error: () => void;
    info: () => void;
    Start: (name: any) => void;
    End: (name: any) => void;
    StartTime: (name: any) => void;
    EndTime: (name: any, msWarn: any) => void;
    StartLog: (name: any) => void;
    EndLog: (name: any) => void;
    Memory: (name: any) => void;
};
export default Profiler;
//# sourceMappingURL=profiler.d.ts.map