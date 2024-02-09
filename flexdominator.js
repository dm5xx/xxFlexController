class flexDominator {
    constructor(nvm = ["AM", "SAM", "FM", "NFM", "DFM"], nvs = [ 1,1000, 2000,3000]) 
    {
        this.NotValidModes = nvm;
        this.NotValidSteps = nvs;
    }

    xmit(elm, flx)
    {
        return "xmit "+elm.State;
    }

    modes(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        let n_mode = this.#getNext(flx["Slice"+sl].mode, flx["Slice"+sl].mode_list, this.NotValidModes);

        return "slice s "+ sl + " mode=" + n_mode;
    }

    #getNext(mode, modelist, notlist)
    {
        let cur_idx = modelist.indexOf(mode);
        cur_idx++;

        if(cur_idx == modelist.length)
            cur_idx = 0;

        while(notlist.indexOf(modelist[cur_idx]) > -1)
        {
            cur_idx++;

            if(cur_idx == modelist.length)
                cur_idx = 0;
        }

        return modelist[cur_idx];
    }

    #hundret27to100Converter(value127)
    {
        return Math.round(value127*0.7874);
    }

    #ritSpreader(state, factor)
    {
        let realstate = state-64; 
        return Math.round(realstate*factor);
    }

    rit(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);


        let ritfac = 70
        if(flx["Slice"+sl].mode == "CW")
            ritfac=7;

        let getRealRit = this.#ritSpreader(elm.State, ritfac)

        if(getRealRit == 0 )
            return "slice s "+ sl + " rit_on=01 rit_freq=0";

        return "slice s "+ sl + " rit_on=1 rit_freq=" + this.#ritSpreader(elm.State, ritfac);
    }

    volume(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        //audio client id slice 0 gain 10
        return "audio client "+ flx.client_handle + " slice " + sl + " gain " + this.#hundret27to100Converter(elm.State);
    }

    agc(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        return "slice s "+ sl + " agc_threshold=" + elm.State;
    }

    vfo(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        if(elm.State == 1)
        {
            flx["Slice"+sl].RF_frequency= flx["Slice"+sl].RF_frequency+flx["Slice"+sl].step*0.000001;
        }
        else
        {
            flx["Slice"+sl].RF_frequency= flx["Slice"+sl].RF_frequency-flx["Slice"+sl].step*0.000001;
        }
        return "slice tune "+ sl + " " + flx["Slice"+sl].RF_frequency;
        // flx.RF_frequency
    }

    steps(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        flx["Slice"+sl].step = this.#getNext(flx["Slice"+sl].step, flx["Slice"+sl].step_list, this.NotValidSteps);

        return "slice s "+ sl + " step=" + flx["Slice"+sl].step;
    }

    getRequestedSlice(elm)
    {
        if(elm.Part == "B")
            return 1;
        return 0;
    }
}

module.exports = flexDominator; 