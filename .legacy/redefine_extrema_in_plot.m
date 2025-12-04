function [extrema, extrema_tag]=...
    redefine_extrema_in_plot(matrix,extrema_redefine,epsilon,extrema_choice)
close all
extrema_tag_ad = 0;
extrema_tag_del = 0;
kb = HebiKeyboard();
state = read(kb);
figure();
plot(matrix,'-r');
hold on
plot(extrema_redefine(:,2),extrema_redefine(:,1),'+')
set(gcf, 'Position', get(0, 'Screensize'));
extrema=extrema_redefine(:,1);
extrema_tag=extrema_redefine(:,2);
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
        plot(extrema_tag',extrema','+');
        set(gcf, 'Position', get(0, 'Screensize'));
    end
    pause(0.01);
end
extrema_tag=double(extrema_tag);
close all
end