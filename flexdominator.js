class flexDominator {
    constructor(masterEmit, defcon) 
    {
        this.Emitter = masterEmit;
        this.Defcon = defcon;
    }

    // todo
    xmit(elm, flx)
    {

        let sl = this.getRequestedSlice(elm);

        flx["Slice"+sl].tx = elm.State;
        
        this.Emitter.emit("cptt", sl, this.getRealSlice(sl, flx), elm.State);
        //return "xmit "+elm.State;
    }

    modes(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        let n_mode = this.#getNext(flx["Slice"+sl].mode, flx["Slice"+sl].mode_list, this.Defcon.NotValidModes);

        flx["Slice"+sl].mode = n_mode;
        return "slice s "+ this.getRealSlice(sl, flx) + " mode=" + n_mode;
    }

    #getNext(mode, modelist, notlist = null)
    {
        let cur_idx = modelist.indexOf(mode);
        cur_idx++;

        if(cur_idx == modelist.length)
            cur_idx = 0;

        if(notlist != null)
        {
            while(notlist.indexOf(modelist[cur_idx]) > -1)
            {
                cur_idx++;
    
                if(cur_idx == modelist.length)
                    cur_idx = 0;
            }    
        }

        return modelist[cur_idx];
    }

    #hundret27to100Converter(value127)
    {
        return Math.round(value127*0.7874);
    }

    #Spreader(state, factor, middle = 64)
    {
        let realstate = state-middle; 
        return Math.round(realstate*factor);
    }

    rit(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        let ritfac = this.Defcon.RitFreq[0]/63;
        if(flx["Slice"+sl].mode == "CW")
            ritfac=this.Defcon.RitFreq[1]/63;

        let getRealRit = this.#Spreader(elm.State, ritfac)

        if(getRealRit == 0 )
            return "slice s "+ this.getRealSlice(sl, flx) + " rit_on=0 rit_freq=0";

        return "slice s "+ this.getRealSlice(sl, flx) + " rit_on=1 rit_freq=" + this.#Spreader(elm.State, ritfac);
    }

    xit(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        let ritfac = this.Defcon.RitFreq[0]/63;
        if(flx["Slice"+sl].mode == "CW")
            ritfac=this.Defcon.RitFreq[1]/63;

        let getRealRit = this.#Spreader(elm.State, ritfac)

        if(getRealRit == 0 )
            return "slice s "+ this.getRealSlice(sl, flx) + " xit_on=0 xit_freq=0";

        return "slice s "+ this.getRealSlice(sl, flx) + " xit_on=1 xit_freq=" + this.#Spreader(elm.State, ritfac);
    }

    volume(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        //audio client id slice 0 gain 10
        return "audio client "+ flx.client_handle + " slice " +  this.getRealSlice(sl, flx) + " gain " + this.#hundret27to100Converter(elm.State);
    }

    agc(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        return "slice s "+ this.getRealSlice(sl, flx) + " agc_threshold=" + elm.State;
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
        return "slice tune "+  this.getRealSlice(sl, flx) + " " + flx["Slice"+sl].RF_frequency;
        // flx.RF_frequency
    }

    steps(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        flx["Slice"+sl].step = this.#getNext(flx["Slice"+sl].step, flx["Slice"+sl].step_list, this.Defcon.NotValidSteps);

        return "slice s "+ this.getRealSlice(sl, flx) + " step=" + flx["Slice"+sl].step;
    }

    filters(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        let fildif = flx["Slice"+sl].filter_hi-flx["Slice"+sl].filter_lo;
        if(flx["Slice"+sl].mode=="CW" || flx["Slice"+sl].mode=="AM")
        {
            let n_fil = this.#getNext(fildif, flx.CWFilter, null)

            let half = n_fil/2;
            flx["Slice"+sl].filter_lo= -half;
            flx["Slice"+sl].filter_hi= half;

        }
        else if(flx["Slice"+sl].mode=="LSB" || flx["Slice"+sl].mode=="DIGL")
        {
            flx["Slice"+sl].filter_hi = -100;

            fildif = (-1)*flx["Slice"+sl].filter_lo+flx["Slice"+sl].filter_hi;
            let n_fil = this.#getNext(fildif, flx.Filter, null);

            flx["Slice"+sl].filter_lo= flx["Slice"+sl].filter_hi-n_fil;
        }
        else if(flx["Slice"+sl].mode=="RTTY")
        {
            let fildif = flx["Slice"+sl].filter_hi-flx["Slice"+sl].filter_lo;

            if(fildif == 270)
                fildif=250;

            let n_fil = this.#getNext(fildif, flx.CWFilter, null)

            let half = n_fil/2;

            flx["Slice"+sl].filter_lo= -half-85;
            flx["Slice"+sl].filter_hi= half-85;

            flx["Slice"+sl].filter_hi= flx["Slice"+sl].filter_lo+n_fil;
        }
        else
        {
            flx["Slice"+sl].filter_lo = 100;

            fildif = flx["Slice"+sl].filter_hi-flx["Slice"+sl].filter_lo
            let n_fil = this.#getNext(fildif, flx.Filter, null);

            flx["Slice"+sl].filter_hi= flx["Slice"+sl].filter_lo+n_fil;
        }

        flx["Slice"+sl].InitFilterBW = flx["Slice"+sl].filter_hi-flx["Slice"+sl].filter_lo;

        return "filt "+ this.getRealSlice(sl, flx)+" "+ flx["Slice"+sl].filter_lo +" "+flx["Slice"+sl].filter_hi;
    }

    toggleRXANT(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        let antNum = 1;
        let rxnum = "A";

        if(sl == 1)
        {
            antNum = 2;
            rxnum = "B";    
        }

        if(flx["Slice"+sl].rxant == flx["Slice"+sl].txant)
            flx["Slice"+sl].rxant = "RX_"+rxnum;
        else
            flx["Slice"+sl].rxant = flx["Slice"+sl].txant;

        return "slice s "+ this.getRealSlice(sl, flx) + " rxant=" + flx["Slice"+sl].rxant;
    }

    toggleTXANT(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        if(flx["Slice"+sl].txant == "ANT1")
            flx["Slice"+sl].txant = "ANT2";
        else
            flx["Slice"+sl].txant = "ANT1";

        return "slice s "+ this.getRealSlice(sl, flx) + " txant=" + flx["Slice"+sl].txant;
    }

    panBW(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        if(flx.PanBW.indexOf(flx["Slice"+sl].panbandwidth) == -1)
        {
            flx["Slice"+sl].panbandwidth = flx.PanBW[flx.PanBW.length-1];
        }

        let n_bw = this.#getNext(flx["Slice"+sl].panbandwidth, flx.PanBW, null);
        flx["Slice"+sl].panbandwidth = n_bw;

        setTimeout(() => this.Emitter.emit("ct", flx["Slice"+sl].RF_frequency), 1000);
        return "display panf s "+ flx["Slice"+sl].pan + " bandwidth=" + flx["Slice"+sl].panbandwidth;
    }

    center(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        this.Emitter.emit("ct", flx["Slice"+sl].RF_frequency);
    }

    fadePan(elm, flx)
    {
        if(flx.SliceNumbs.length < 2)
            return null;
        
        let val = this.#Spreader(this.#hundret27to100Converter(elm.State), 1, 50);

        let cv = (50+val);

        if(cv < 50)
        {
            return "audio client "+ flx.client_handle + " slice "+ this.getRealSlice(0, flx)+" pan " + cv;
        }
        return "audio client "+ flx.client_handle + " slice "+ this.getRealSlice(1, flx)+" pan " + cv;
    }

    fadeSO2R(elm, flx)
    {
        if(flx.SliceNumbs.length < 2)
            return null;

        let val = this.#hundret27to100Converter(elm.State);

        if(val<3)
        {
            this.Emitter.emit("fadeSO2R", flx, 0, this.getRealSlice(0, flx), this.getRealSlice(1, flx));
        }
        else if(val>97)
        {
            this.Emitter.emit("fadeSO2R", flx, 1, this.getRealSlice(0, flx), this.getRealSlice(1, flx));

        }
        else
        {
            this.Emitter.emit("fadeSO2R", flx, 2, this.getRealSlice(0, flx), this.getRealSlice(1, flx));
        }
    }

    fadeSO2RMix(elm, flx)
    {
        if(flx.SliceNumbs.length < 2)
            return null;

        let val = this.#hundret27to100Converter(elm.State);

        if(val<3)
        {
            this.Emitter.emit("fadeSO2RMix", flx, 0, this.getRealSlice(0, flx), this.getRealSlice(1, flx));
        }
        else if(val>97)
        {
            this.Emitter.emit("fadeSO2RMix", flx, 1, this.getRealSlice(0, flx), this.getRealSlice(1, flx));

        }
        else
        {
            this.Emitter.emit("fadeSO2RMix", flx, 2, this.getRealSlice(0, flx), this.getRealSlice(1, flx))
        }
    }

    freeFilter(elm, flx)
    {

        let sl = this.getRequestedSlice(elm, flx);
        let val = (this.#hundret27to100Converter(elm.State));

        let fildif = flx["Slice"+sl].InitFilterBW;
        let newval = 0; 
        let neloval = 0; 

        if(flx["Slice"+sl].mode=="USB")
        {
            if(val<50)
            {
                newval= flx["Slice"+sl].filter_lo + flx["Slice"+sl].filter_hi-(((50-val)*2/100)*fildif);
            }
            else if(val==50)
            {
                newval= flx["Slice"+sl].filter_lo + fildif;
            }
            else{
                newval= flx["Slice"+sl].filter_lo + flx["Slice"+sl].filter_hi+(((val-50)*2/100)*fildif);
            }    
            return "filt "+this.getRealSlice(sl, flx)+" "+ flx["Slice"+sl].filter_lo +" "+newval;
        }
        else if(flx["Slice"+sl].mode=="LSB")
        {
            if(val<50)
            {
                newval= flx["Slice"+sl].filter_lo + (((50-val)*2/100)*fildif) -100;
            }
            else if(val==50)
            {
                newval= flx["Slice"+sl].filter_hi - fildif;
            }
            else{
                newval= flx["Slice"+sl].filter_lo - (((val-50)*2/100)*fildif);
            }    
            return "filt "+this.getRealSlice(sl, flx)+" "+ newval +" "+flx["Slice"+sl].filter_hi;
        }
        else if(flx["Slice"+sl].mode=="CW")
        {
            let half = fildif/2;
            if(val<50)
            {
                neloval=-1*half-((val-50)*2/100)*half;
                newval=half+((val-50)*2/100)*half;
            }
            else if(val==50)
            {
                neloval= -1*half;
                newval= half;
            }
            else
            {
                neloval=-1*half-((val-50)*2/100)*half;
                newval=half+((val-50)*2/100)*half;
            }    
            return "filt "+this.getRealSlice(sl, flx)+" "+ neloval +" "+newval;
        }
    }

    monitor(elm, flx)
    {
        return "transmit s mon="+elm.State;
    }

    cwxLoopBtnL(elm, flx)
    {
        switch (elm.Id) {
            case "6|16":
                if(this.Defcon.CWMakro[0] !== undefined)
                    return "cwx send "+this.#convertSpace(this.Defcon.CWMakro[0]); 
            case "6|17":
                if(this.Defcon.CWMakro[1] !== undefined)
                    return "cwx send "+this.#convertSpace(this.Defcon.CWMakro[1]);
            case "6|18":
                if(this.Defcon.CWMakro[2] !== undefined)
                    return "cwx send "+this.#convertSpace(this.Defcon.CWMakro[2]);
            case "6|19":
                if(this.Defcon.CWMakro[3] !== undefined)
                    return "cwx send "+this.#convertSpace(this.Defcon.CWMakro[3]);
        }
        return null;
    }

    cwxLoopBtnR(elm, flx)
    {
        switch (elm.Id) {
            case "7|16":
                if(this.Defcon.CWMakro[4] !== undefined)
                    return "cwx send "+this.#convertSpace(this.Defcon.CWMakro[4]);                 
            case "7|17":
                if(this.Defcon.CWMakro[5] !== undefined)
                    return "cwx send "+this.#convertSpace(this.Defcon.CWMakro[5]);
            case "7|18":
                if(this.Defcon.CWMakro[6] !== undefined)
                    return "cwx send "+this.#convertSpace(this.Defcon.CWMakro[6]);
            case "7|19":
                if(this.Defcon.CWMakro[7] !== undefined)
                    return "cwx send "+this.#convertSpace(this.Defcon.CWMakro[7]);             
        }
        return null;
    }

    #convertSpace(txtcmd)
    {
        return txtcmd.replaceAll(" ", String.fromCharCode(127));
    }

    setdefault(elm, flx)
    {
        this.Emitter.emit("def", flx.Slice0.RF_frequency, flx.Slice0.mode);
    }

    configMode(elm, flx)
    {
        this.Emitter.emit("con");
    }

    toggleLayer(elm, flx)
    {
        //elm.toggleState();
        this.Emitter.emit("tgl", elm);
    }

    toggleSlices(elm, flx)
    {
       flx.SliceNumbs.reverse(); 

       let s0 = flx.Slice0;
       let s1 = flx.Slice1;
       
       flx.Slice0 = s1;
       flx.Slice1 = s0;
   
    }

    getRequestedSlice(elm)
    {
        if(elm.Part == "B")
            return 1;
        return 0;
    }

    getRealSlice(nr, flx)
    {
        if(nr == 1)
            return flx.SliceNumbs[1];
        return flx.SliceNumbs[0];
    }
}

module.exports = flexDominator; 