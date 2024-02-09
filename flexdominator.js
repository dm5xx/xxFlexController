class flexDominator {
    constructor(nvm = ["AM", "SAM", "FM", "NFM", "DFM"]) 
    {
        this.NotValidModes = nvm
    }

    xmit(elm, flx)
    {
        return "xmit "+elm.State;
    }

    /* mode = USB
    /*  .mode_list = ["LSB", "USB", "AM*", "CW", "DIGL", "DIGU", "SAM*", "FM*", "NFM*", "DFM*", "RTTY*",]*/
    modes(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        //let next_mode = flx["Slice0"].mode_list.indexOf(flx["Slice0"].mode);
        let n_mode = this.#getNextMode(flx["Slice"+sl].mode, flx["Slice"+sl].mode_list);

        return "slice s "+ sl + " mode=" + n_mode;
    }

    #getNextMode(mode, modelist)
    {
        let cur_idx = modelist.indexOf(mode);
        cur_idx++;

        if(cur_idx == modelist.length)
            cur_idx = 0;

        while(this.NotValidModes.indexOf(modelist[cur_idx]) > -1)
        {
            cur_idx++;

            if(cur_idx == modelist.length)
                cur_idx = 0;
        }

        return modelist[cur_idx];
    }

    vfo(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        if(elm.State == 1)
        {
            let fr= flx["Slice"+sl].RF_frequency+flx["Slice"+sl].step*0.000001;

            return "slice tune "+ sl + " " + fr;
        }
        // flx.RF_frequency
    }

    getRequestedSlice(elm)
    {
        if(elm.Part == "B")
            return 1;
        return 0;
    }
}

module.exports = flexDominator; 