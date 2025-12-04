function [extrema, extrema_tag,kind_of_extrema]=...
    finding_extrema_in_plot_marked(matrix,abs,epsilon,extrema_ref,extrema_choice,pattern,choice_ref)
close all
extrema_tag_ad = 0;
extrema_tag_del = 0;
kb = HebiKeyboard();
state = read(kb);
figure();
plot(matrix,'-r');
grid minor
    title(['reference-Data from column ',choice_ref])
    ylabel('Elongation [a.u.]')
    xlabel('timestep')
    hold on
    for i=1:length(extrema_ref)-2
        if (extrema_ref(i,3) == str2num(pattern(1))) && ...
                (extrema_ref(i+1,3) == str2num(pattern(2))) && ...
                (extrema_ref(i+2,3) == str2num(pattern(3)))
            h=patch([...
                extrema_ref(i,2) ...
                extrema_ref(i,2) ...
                extrema_ref(i+2,2) ...
                extrema_ref(i+2,2)],...
                [...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1))...
                ],'b');
            h.FaceAlpha = 0.1;
            hold on   
        else   
        end
    end 
    set(gcf, 'Position', get(0, 'Screensize'));

hold on
if extrema_choice == 'max'
    [extrema, extrema_tag]=findpeaks(matrix(:),'MINPEAKDISTANCE',abs);
    kind_of_extrema=1;
elseif extrema_choice == 'min'
    [extrema, extrema_tag]=findpeaks(-matrix(:),'MINPEAKDISTANCE',abs);
    extrema=-extrema;
    kind_of_extrema=-1;
end
plot(extrema_tag',extrema','*c');
grid minor
set(gcf, 'Position', get(0, 'Screensize'));
while ~state.keys('q')
    state = read(kb);
    status = 2;
    if state.keys('c')
        [extrema_tag_change, ~,status]=ginput(1);
    end
    switch status
        case 1
            extrema_tag_ad=int32(extrema_tag_change);
            if extrema_choice == 'max'
                [ ~ , extrema_tag_temp]=...
                    max(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            else
                [ ~ , extrema_tag_temp]=...
                    min(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            end
            %attention -  one click means one input maxima matrix
            extrema_tag_ad=extrema_tag_ad-epsilon+extrema_tag_temp-1;
            extrema_tag=sort([extrema_tag; extrema_tag_ad(:,1)]);
            beep;
            
        case 3
            extrema_tag_del=int32(extrema_tag_change);
            for i=1:1:length(extrema_tag)-1
                if sqrt((double(extrema_tag(i))-double(extrema_tag_del))^2)<15
                    extrema_tag(i)=[];
                    beep;
                end
            end
            %wörkaround if last point should be deleted
            if length(extrema_tag)==(i+1)
                extrema_tag(end)=[];
                beep;
            end
        otherwise
    end
    if status == 1 || status == 3
        extrema=[];
        for i=1:1:length(extrema_tag)
            extrema(i,1)= matrix(extrema_tag(i));
        end
        clf
        plot(matrix,'-r');
        hold on
        plot(extrema_tag',extrema','*c');
        grid minor
            for i=1:length(extrema_ref)-2
        if (extrema_ref(i,3) == str2num(pattern(1))) && ...
                (extrema_ref(i+1,3) == str2num(pattern(2))) && ...
                (extrema_ref(i+2,3) == str2num(pattern(3)))
            h=patch([...
                extrema_ref(i,2) ...
                extrema_ref(i,2) ...
                extrema_ref(i+2,2) ...
                extrema_ref(i+2,2)],...
                [...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1))...
                ],'b');
            h.FaceAlpha = 0.1;
            hold on   
        else   
        end
    end 
    set(gcf, 'Position', get(0, 'Screensize'));
        
    end
    pause(0.01);
end
extrema_tag=double(extrema_tag);
close all
end